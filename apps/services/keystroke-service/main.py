"""
Keystroke Dynamics Authentication Service
FastAPI microservice for behavioral biometrics
"""

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Optional
import os
import numpy as np
from datetime import datetime
import asyncio
import json
import pika

from feature_extraction import KeystrokeFeatureExtractor
from typenet_inference import TypeNetAuthenticator
from behavioral_analysis import (
    BehavioralAnalyzer, 
    KeystrokeSessionEvent, 
    BehavioralAnalysisResult,
    format_analysis_report
)

# Initialize FastAPI app
app = FastAPI(
    title="Keystroke Dynamics Authentication API",
    description="Behavioral biometrics API for continuous student authentication",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global instances
feature_extractor = KeystrokeFeatureExtractor()

# TypeNet model path
typenet_model_path = os.path.join(os.path.dirname(__file__), 'models', 'typenet_pretrained.pth')
typenet_template_path = os.path.join(os.path.dirname(__file__), 'models', 'user_templates.pkl')

# Initialize TypeNet authenticator
authenticator = TypeNetAuthenticator(
    model_path=typenet_model_path if os.path.exists(typenet_model_path) else None,
    device='cpu'  # Change to 'cuda' if GPU available
)

# Load user templates if available
if os.path.exists(typenet_template_path):
    try:
        authenticator.load_templates(typenet_template_path)
        print(f"✅ Loaded {len(authenticator.user_templates)} user templates from TypeNet")
    except Exception as e:
        print(f"⚠️  Failed to load user templates: {e}")
else:
    print("ℹ️  No user templates found. Users need to be enrolled.")
    print("   Use /api/keystroke/enroll endpoint to enroll users.")

# Initialize behavioral analyzer (Gemini API key optional — loaded from env)
behavioral_analyzer = BehavioralAnalyzer()

# In-memory session storage (use Redis in production)
active_sessions = {}

# RabbitMQ Configuration
RABBITMQ_HOST = os.getenv('RABBITMQ_HOST', 'localhost')
RABBITMQ_EXCHANGE = 'keystroke.exchange'
RABBITMQ_ROUTING_KEY = 'keystroke.auth.result'

def publish_auth_event(event_data: dict):
    """Publish authentication event to RabbitMQ"""
    try:
        connection = pika.BlockingConnection(
            pika.ConnectionParameters(host=RABBITMQ_HOST)
        )
        channel = connection.channel()

        # Declare exchange
        channel.exchange_declare(
            exchange=RABBITMQ_EXCHANGE,
            exchange_type='topic',
            durable=True
        )

        # Publish message
        channel.basic_publish(
            exchange=RABBITMQ_EXCHANGE,
            routing_key=RABBITMQ_ROUTING_KEY,
            body=json.dumps(event_data),
            properties=pika.BasicProperties(
                content_type='application/json',
                delivery_mode=2  # Make message persistent
            )
        )

        connection.close()
        print(f"✅ Published auth event to RabbitMQ for student: {event_data.get('studentId')}")
    except Exception as e:
        print(f"⚠️ Failed to publish to RabbitMQ: {e}")
        # Don't fail the request if RabbitMQ publish fails


# ==================== Pydantic Models ====================

class KeystrokeEvent(BaseModel):
    userId: str
    sessionId: str
    timestamp: int
    key: str
    dwellTime: int
    flightTime: int
    keyCode: int


class KeystrokeBatch(BaseModel):
    events: List[KeystrokeEvent]


class EnrollmentRequest(BaseModel):
    userId: str
    keystrokeEvents: List[Dict]


class VerificationRequest(BaseModel):
    userId: str
    keystrokeEvents: List[Dict]
    threshold: Optional[float] = 0.7
    assignmentId: Optional[str] = None
    courseId: Optional[str] = None


class IdentificationRequest(BaseModel):
    keystrokeEvents: List[Dict]
    topK: Optional[int] = 3




class BehavioralAnalysisRequest(BaseModel):
    sessionId: str
    studentId: str
    events: List[Dict]
    finalCode: str
    includeReport: Optional[bool] = False
class MonitoringRequest(BaseModel):
    userId: str
    sessionId: str
    assignmentId: Optional[str] = None
    courseId: Optional[str] = None


# ==================== Health Check ====================

@app.get("/health")
async def health_check():
    """Health check endpoint for container orchestration"""
    return {
        "status": "healthy",
        "service": "keystroke-service",
        "version": "1.0.0"
    }


@app.get("/")
async def root():
    return {
        "service": "Keystroke Dynamics Authentication",
        "status": "running",
        "version": "1.0.0",
        "endpoints": {
            "capture": "/api/keystroke/capture",
            "enroll": "/api/keystroke/enroll",
            "verify": "/api/keystroke/verify",
            "identify": "/api/keystroke/identify",
            "monitor": "/api/keystroke/monitor",
            "enrolled_users": "/api/keystroke/users/enrolled"
        }
    }


# ==================== API Endpoints ====================

@app.post("/api/keystroke/capture")
async def capture_keystrokes(batch: KeystrokeBatch):
    """
    Capture keystroke events from frontend
    Store in session buffer for continuous monitoring
    """
    try:
        events = [event.dict() for event in batch.events]

        if not events:
            raise HTTPException(status_code=400, detail="No events provided")

        user_id = events[0]['userId']
        session_id = events[0]['sessionId']

        # Initialize session storage if not exists
        session_key = f"{user_id}:{session_id}"
        if session_key not in active_sessions:
            active_sessions[session_key] = {
                'events': [],
                'last_verification': None,
                'risk_score': 0.0
            }

        # Add events to session buffer
        active_sessions[session_key]['events'].extend(events)

        # Keep only recent events (last 500)
        active_sessions[session_key]['events'] = active_sessions[session_key]['events'][-500:]

        return {
            "success": True,
            "captured": len(events),
            "total_buffered": len(active_sessions[session_key]['events'])
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/keystroke/enroll")
async def enroll_user(request: EnrollmentRequest):
    """
    Enroll a user by creating a behavioral biometric template
    Requires multiple typing samples (minimum 5 recommended)
    """
    try:
        user_id = request.userId
        all_events = request.keystrokeEvents

        if len(all_events) < 150:  # Minimum data for reliable enrollment (at least 2 sequences of 70)
            raise HTTPException(
                status_code=400,
                detail="Insufficient data for enrollment. Please provide at least 150 keystroke events."
            )

        # Split events into sequences for TypeNet (70 keystrokes each)
        sequence_length = 70
        sequences = []

        for i in range(0, len(all_events) - sequence_length, sequence_length // 2):  # 50% overlap
            sequence_events = all_events[i:i + sequence_length]
            sequence = feature_extractor.create_typenet_sequence(sequence_events, sequence_length)
            sequences.append(sequence)

        if len(sequences) < 3:
            raise HTTPException(
                status_code=400,
                detail="Could not create enough sequences. Please provide more data."
            )

        # Enroll user
        result = authenticator.enroll_user(user_id, sequences)

        # Save templates to disk immediately (persistence for new enrollments)
        authenticator.save_templates(typenet_template_path)

        return {
            "success": True,
            "user_id": user_id,
            "sequences_created": len(sequences),
            "enrollment_complete": True,
            "message": "User enrolled successfully. Authentication is now active."
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/keystroke/verify")
async def verify_user(request: VerificationRequest):
    """
    Verify a user's identity based on their keystroke pattern
    Returns authentication status and risk score
    """
    try:
        user_id = request.userId
        events = request.keystrokeEvents
        threshold = request.threshold

        if len(events) < 70:
            raise HTTPException(
                status_code=400,
                detail="Insufficient data for verification. Need at least 70 keystrokes."
            )

        # Create sequence for TypeNet
        sequence = feature_extractor.create_typenet_sequence(events, sequence_length=70)

        # Verify
        result = authenticator.verify_user(user_id, sequence, threshold)

        # Publish auth event to RabbitMQ
        auth_event = {
            "studentId": user_id,
            "assignmentId": request.assignmentId,
            "courseId": request.courseId,
            "sessionId": None,
            "confidenceLevel": result.get('similarity', 0) * 100,  # Convert to percentage
            "riskScore": result.get('risk_score', 0) * 100,  # Convert to percentage
            "keystrokeSampleSize": len(events),
            "timestamp": datetime.now().isoformat(),
            "authenticated": result.get('authenticated', False),
            "similarityScore": result.get('similarity', 0) * 100,
            "metadata": json.dumps({"threshold": threshold})
        }
        publish_auth_event(auth_event)

        return result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/keystroke/identify")
async def identify_user(request: IdentificationRequest):
    """
    Identify a user by comparing their keystroke pattern against all enrolled users
    Returns top K matching users with confidence scores
    """
    try:
        events = request.keystrokeEvents
        top_k = request.topK

        # Check if any users are enrolled
        if not authenticator.user_templates:
            raise HTTPException(
                status_code=404,
                detail="No users enrolled yet. Please enroll at least one user first."
            )

        # Validate minimum keystroke count
        if len(events) < 70:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient data for reliable identification. Need at least 70 keystrokes. Got: {len(events)}"
            )

        # Create sequence from events for TypeNet
        sequence = feature_extractor.create_typenet_sequence(events, sequence_length=70)

        # Identify user
        result = authenticator.identify_user(sequence, top_k)

        return result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/keystroke/monitor")
async def monitor_session(request: MonitoringRequest):
    """
    Perform continuous authentication on an active session
    Analyzes recent keystroke patterns and returns risk assessment
    """
    try:
        user_id = request.userId
        session_id = request.sessionId
        session_key = f"{user_id}:{session_id}"

        if session_key not in active_sessions:
            raise HTTPException(status_code=404, detail="Session not found")

        session_data = active_sessions[session_key]
        events = session_data['events']

        if len(events) < 150:
            return {
                "success": True,
                "status": "COLLECTING_DATA",
                "message": f"Collecting baseline data. {len(events)}/150 events captured.",
                "risk_score": 0.0
            }

        # Create multiple sequences from recent data for TypeNet
        sequence_length = 70
        sequences = []

        for i in range(len(events) - sequence_length, 0, -sequence_length):
            if i < 0:
                break
            sequence_events = events[i:i + sequence_length]
            sequence = feature_extractor.create_typenet_sequence(sequence_events, sequence_length)
            sequences.append(sequence)

            if len(sequences) >= 5:  # Analyze last 5 sequences
                break

        if not sequences:
            raise HTTPException(status_code=400, detail="Could not create sequences")

        # Perform continuous authentication
        result = authenticator.continuous_authentication(user_id, sequences)

        # Update session
        session_data['last_verification'] = datetime.now().isoformat()
        session_data['risk_score'] = result.get('average_risk_score', 0.0)

        # Publish auth event to RabbitMQ
        auth_event = {
            "studentId": user_id,
            "assignmentId": request.assignmentId,
            "courseId": request.courseId,
            "sessionId": session_id,
            "confidenceLevel": (1 - result.get('average_risk_score', 0)) * 100,
            "riskScore": result.get('average_risk_score', 0) * 100,
            "keystrokeSampleSize": len(events),
            "timestamp": datetime.now().isoformat(),
            "authenticated": result.get('status') == 'AUTHENTICATED',
            "similarityScore": (1 - result.get('average_risk_score', 0)) * 100,
            "metadata": json.dumps({
                "verification_count": len(sequences),
                "status": result.get('status')
            })
        }
        publish_auth_event(auth_event)

        return result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/keystroke/session/status/{user_id}/{session_id}")
async def get_session_status(user_id: str, session_id: str):
    """Get current status of a monitoring session"""
    session_key = f"{user_id}:{session_id}"

    if session_key not in active_sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    session_data = active_sessions[session_key]

    return {
        "success": True,
        "user_id": user_id,
        "session_id": session_id,
        "events_captured": len(session_data['events']),
        "last_verification": session_data['last_verification'],
        "current_risk_score": session_data['risk_score']
    }


@app.delete("/api/keystroke/session/{user_id}/{session_id}")
async def end_session(user_id: str, session_id: str):
    """End a monitoring session and clean up"""
    session_key = f"{user_id}:{session_id}"

    if session_key in active_sessions:
        del active_sessions[session_key]
        return {"success": True, "message": "Session ended"}

    raise HTTPException(status_code=404, detail="Session not found")



@app.post("/api/keystroke/analyze")
async def analyze_behavioral_session(request: BehavioralAnalysisRequest):
    """
    Perform comprehensive behavioral analysis on a coding session
    
    Analyzes:
    - Developmental logic & iteration patterns
    - Cognitive load & behavioral proxies
    - Authenticity & pattern matching
    - Provides pedagogical feedback
    
    Returns detailed analysis including:
    - Session metrics
    - Authenticity indicators
    - Cognitive analysis
    - Process scores
    - Critical anomalies
    - Pedagogical recommendations
    """
    try:
        # Convert events to KeystrokeSessionEvent objects
        session_events = []
        for event in request.events:
            try:
                session_event = KeystrokeSessionEvent(
                    timestamp=event.get('timestamp', 0),
                    key=event.get('key', ''),
                    keyCode=event.get('keyCode', 0),
                    dwellTime=event.get('dwellTime', 0),
                    flightTime=event.get('flightTime', 0),
                    action=event.get('action', 'type'),
                    lineNumber=event.get('lineNumber'),
                    columnNumber=event.get('columnNumber'),
                    codeSnapshot=event.get('codeSnapshot')
                )
                session_events.append(session_event)
            except Exception as e:
                print(f"⚠️  Skipping invalid event: {e}")
                continue
        
        if len(session_events) < 10:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient data for analysis. Need at least 10 valid events. Got: {len(session_events)}"
            )
        
        # Perform behavioral analysis
        analysis_result = behavioral_analyzer.analyze_session(
            session_id=request.sessionId,
            student_id=request.studentId,
            events=session_events,
            final_code=request.finalCode
        )
        
        # Convert to dict for JSON response
        result_dict = analysis_result.model_dump()
        
        # Optionally include formatted report
        if request.includeReport:
            result_dict['formatted_report'] = format_analysis_report(analysis_result)
        
        return {
            "success": True,
            "analysis": result_dict
        }
        
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@app.get("/api/keystroke/analyze/config")
async def get_analysis_config():
    """Get current behavioral analysis configuration"""
    return {
        "success": True,
        "config": {
            "llm_enabled": behavioral_analyzer.model is not None,
            "llm_model": "gemini-2.5-flash" if behavioral_analyzer.model else None,
            "analysis_features": [
                "Developmental Logic & Iteration",
                "Cognitive Load Analysis",
                "Authenticity Detection",
                "Pedagogical Feedback"
            ],
            "metrics_tracked": [
                "Typing speed",
                "Pause patterns",
                "Deletion rate",
                "Copy/paste detection",
                "Friction points",
                "Cognitive load timeline"
            ]
        }
    }

@app.get("/api/keystroke/users/enrolled")
async def list_enrolled_users():
    """List all enrolled users"""
    enrolled_users = list(authenticator.user_templates.keys())

    return {
        "success": True,
        "count": len(enrolled_users),
        "users": enrolled_users
    }


# ==================== WebSocket for Real-Time Monitoring ====================

@app.websocket("/ws/monitor/{user_id}/{session_id}")
async def websocket_monitor(websocket: WebSocket, user_id: str, session_id: str):
    """
    WebSocket endpoint for real-time authentication monitoring
    Sends continuous risk score updates to frontend
    """
    await websocket.accept()

    session_key = f"{user_id}:{session_id}"

    try:
        while True:
            # Check session every 5 seconds
            await asyncio.sleep(5)

            if session_key in active_sessions:
                session_data = active_sessions[session_key]

                # Send status update
                await websocket.send_json({
                    "type": "status_update",
                    "user_id": user_id,
                    "session_id": session_id,
                    "risk_score": session_data['risk_score'],
                    "events_captured": len(session_data['events']),
                    "timestamp": datetime.now().isoformat()
                })

                # Alert if high risk
                if session_data['risk_score'] > 0.7:
                    await websocket.send_json({
                        "type": "alert",
                        "level": "HIGH",
                        "message": "Potential impersonation detected!",
                        "risk_score": session_data['risk_score']
                    })

    except WebSocketDisconnect:
        print(f"WebSocket disconnected for {session_key}")


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8003))
    uvicorn.run(app, host="0.0.0.0", port=port)
