"""Evaluation worker for processing submission events."""

import asyncio
from typing import Optional

from app.config import Settings
from app.logging_config import get_logger
from app.schemas import SubmissionEvent
from app.schemas.rubric import DEFAULT_RUBRIC_CONFIG, RubricConfig, RubricScoringInput
from app.services.evaluation.ast_parser import ASTParser
from app.services.evaluation.llm_gateway import LLMGateway
from app.services.evaluation.rubric_engine import RubricEngine
from app.services.storage.minio_client import MinIOClient
from app.services.storage.postgres_client import PostgresClient

logger = get_logger(__name__)


class EvaluationWorker:
    """Worker that processes submission events and extracts AST blueprints."""

    def __init__(
        self,
        settings: Settings,
        minio_client: MinIOClient,
        postgres_client: PostgresClient,
    ):
        """Initialize evaluation worker.
        
        Args:
            settings: Application settings
            minio_client: MinIO client for code retrieval
            postgres_client: PostgreSQL client for AST storage
        """
        self.settings = settings
        self.minio = minio_client
        self.postgres = postgres_client
        self.ast_parser = ASTParser()
        self.rubric_engine = RubricEngine()
        self.llm_gateway = LLMGateway()

    async def process_event(self, event: SubmissionEvent) -> None:
        """Process a submission event.
        
        Args:
            event: Submission event from RabbitMQ
        """
        logger.info(
            "processing_submission",
            submission_id=str(event.submission_id),
            assignment_id=str(event.assignment_id),
            language=event.language,
        )

        try:
            # Get source code
            code = await self._get_code(event)
            if not code:
                await self._store_failure(
                    event,
                    "empty_source_code",
                    "No source code available",
                )
                return

            # Parse AST
            blueprint = await self._parse_ast(event, code)
            
            # Store blueprint
            await self.postgres.store_ast_blueprint(
                submission_id=event.submission_id,
                assignment_id=event.assignment_id,
                language=event.language,
                blueprint=blueprint,
            )

            # Perform rubric-based scoring
            await self._score_submission(event, code, blueprint)
            
            logger.info(
                "submission_processed_successfully",
                submission_id=str(event.submission_id),
            )

        except Exception as e:
            logger.error(
                "submission_processing_failed",
                submission_id=str(event.submission_id),
                error=str(e),
            )
            await self._store_failure(
                event,
                "processing_error",
                str(e),
            )

    async def _get_code(self, event: SubmissionEvent) -> str:
        """Get source code from event or MinIO.
        
        Args:
            event: Submission event
            
        Returns:
            Source code string
        """
        # Use code from event if available
        if event.code:
            return event.code
            
        # Otherwise fetch from MinIO (runs in thread pool to avoid blocking)
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None,  # Use default executor
            lambda: self.minio.get_submission_code_sync(event.storage_path),
        )

    async def _parse_ast(self, event: SubmissionEvent, code: str):
        """Parse AST from source code.
        
        Args:
            event: Submission event
            code: Source code
            
        Returns:
            AST blueprint
        """
        # Run CPU-bound parsing in thread pool to avoid blocking event loop
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None,  # Use default executor
            lambda: self.ast_parser.parse(
                code=code,
                language=event.language,
                language_id=event.language_id,
            ),
        )

    async def _store_failure(
        self,
        event: SubmissionEvent,
        reason: str,
        details: str,
    ) -> None:
        """Store parse failure information.
        
        Args:
            event: Submission event
            reason: Failure reason
            details: Error details
        """
        await self.postgres.store_parse_failure(
            submission_id=event.submission_id,
            assignment_id=event.assignment_id,
            language=event.language,
            failure_reason=reason,
            error_details={"details": details},
        )

    async def _score_submission(
        self,
        event: SubmissionEvent,
        code: str,
        blueprint,
    ) -> None:
        """Score submission using rubric engine.
        
        Args:
            event: Submission event
            code: Source code
            blueprint: AST blueprint
        """
        try:
            # Get rubric config for assignment
            rubric_dict = await self.postgres.get_rubric_config(event.assignment_id)
            
            if rubric_dict:
                rubric_config = RubricConfig.model_validate(rubric_dict)
                rubric_version = rubric_dict.get("version", 1)
            else:
                # Use default rubric
                rubric_config = DEFAULT_RUBRIC_CONFIG
                rubric_version = 1
                logger.info(
                    "using_default_rubric",
                    assignment_id=str(event.assignment_id),
                )

            # Build scoring input
            scoring_input = RubricScoringInput(
                submission_id=str(event.submission_id),
                assignment_id=str(event.assignment_id),
                code=code,
                language=event.language,
                ast_blueprint=blueprint.model_dump(),
                rubric_config=rubric_config,
            )

            # Get semantic scores from LLM if available
            semantic_scores = None
            try:
                llm_result = self.llm_gateway.generate_semantic_scores(
                    code=code,
                    ast_blueprint=blueprint.model_dump(),
                    rubric_config=rubric_config,
                    language=event.language,
                )
                if llm_result:
                    semantic_scores = {
                        "logical_correctness": llm_result.logical_correctness.score,
                        "best_practices": llm_result.best_practices.score,
                        "code_quality": llm_result.code_quality.score,
                        "conceptual_understanding": llm_result.conceptual_understanding.score,
                    }
                    logger.info(
                        "llm_semantic_scoring_completed",
                        submission_id=str(event.submission_id),
                    )
            except Exception as e:
                logger.warning(
                    "llm_scoring_failed",
                    submission_id=str(event.submission_id),
                    error=str(e),
                )

            # Calculate scores
            score_result = self.rubric_engine.score_submission(
                input_data=scoring_input,
                semantic_scores=semantic_scores,
            )

            # Store evaluation results
            await self.postgres.store_acafs_evaluation(
                submission_id=event.submission_id,
                assignment_id=event.assignment_id,
                criteria_breakdown=score_result.criteria_breakdown.model_dump(),
                total_score=score_result.total_score,
                semantic_feedback={
                    "llm_scored": semantic_scores is not None,
                    "rubric_version": rubric_version,
                } if semantic_scores else None,
            )

            # Also update submissions table
            await self.postgres.store_evaluation_results(
                submission_id=event.submission_id,
                criteria_breakdown=score_result.criteria_breakdown.model_dump(),
                total_score=score_result.total_score,
                rubric_version_id=rubric_version,
            )

            logger.info(
                "submission_scored",
                submission_id=str(event.submission_id),
                total_score=score_result.total_score,
                execution=score_result.criteria_breakdown.execution,
                logical_correctness=score_result.criteria_breakdown.logical_correctness,
            )

        except Exception as e:
            logger.error(
                "scoring_failed",
                submission_id=str(event.submission_id),
                error=str(e),
            )
            # Don't fail the whole processing, just log the error

    def close(self) -> None:
        """Clean up resources."""
        logger.info("evaluation_worker_closed")
