"""
FAISS Index: Approximate Nearest Neighbor Search for 6D vectors.

This module provides FAISS-based indexing for efficient similarity search
in the 6D feature space, enabling O(log N) clone detection.
"""

from pathlib import Path
from typing import List, Optional, Tuple

import numpy as np

try:
    import faiss
except ImportError:
    faiss = None  # type: ignore


class FAISSIndex:
    """
    FAISS-based Approximate Nearest Neighbor Search (ANNS) for 6D feature vectors.

    Supports multiple index types:
    - Flat: Exact search (small datasets, < 10K vectors)
    - IVF: Inverted File Index (medium datasets, 10K-1M vectors)
    - HNSW: Hierarchical Navigable Small World (high accuracy, large datasets)

    Example:
        >>> index = FAISSIndex(dimension=6, index_type='IVF')
        >>> index.add(vectors, fragment_ids)
        >>> results = index.search(query_vector, k=10)
    """

    def __init__(self, dimension: int = 6, index_type: str = "IVF", nlist: int = 100):
        """
        Initialize FAISS index.

        Args:
            dimension: Feature vector dimension (default: 6 for ToMA features)
            index_type: Index type ('IVF', 'HNSW', 'Flat')
            nlist: Number of Voronoi cells for IVF (default: 100)
        """
        if faiss is None:
            raise ImportError(
                "faiss is not installed. Install with: pip install faiss-cpu"
            )

        self.dimension = dimension
        self.index_type = index_type
        self.nlist = nlist
        self.index = None
        self.fragment_ids: List[str] = []
        self.is_trained = False

        self._initialize_index()

    def _initialize_index(self):
        """Initialize FAISS index based on type."""
        if self.index_type == "IVF":
            # IVF (Inverted File Index) for medium-scale datasets
            quantizer = faiss.IndexFlatL2(self.dimension)
            self.index = faiss.IndexIVFFlat(
                quantizer, self.dimension, self.nlist, faiss.METRIC_L2
            )
        elif self.index_type == "HNSW":
            # HNSW for high-accuracy ANN
            M = 16  # Number of connections per layer
            self.index = faiss.IndexHNSWFlat(self.dimension, M, faiss.METRIC_L2)
        else:
            # Flat index (exact search, small datasets)
            self.index = faiss.IndexFlatL2(self.dimension)

    def train(self, vectors: np.ndarray):
        """
        Train the index (required for IVF).

        Args:
            vectors: Training vectors (N x dimension)
        """
        if self.index_type == "IVF":
            if len(vectors) < self.nlist:
                # Not enough vectors to train all clusters
                # Reduce nlist or use Flat index
                print(
                    f"Warning: Only {len(vectors)} vectors for training, "
                    f"but nlist={self.nlist}. Using Flat index instead."
                )
                self.index = faiss.IndexFlatL2(self.dimension)
                self.index_type = "Flat"
            else:
                self.index.train(vectors)
                self.is_trained = True

    def add(self, vectors: np.ndarray, fragment_ids: List[str]):
        """
        Add vectors to the index.

        Args:
            vectors: Feature vectors to add (N x dimension)
            fragment_ids: Corresponding fragment IDs
        """
        if vectors.shape[1] != self.dimension:
            raise ValueError(
                f"Vector dimension {vectors.shape[1]} doesn't match "
                f"index dimension {self.dimension}"
            )

        if self.index_type == "IVF" and not self.is_trained:
            self.train(vectors)

        self.index.add(vectors.astype(np.float32))
        self.fragment_ids.extend(fragment_ids)

    def search(self, query_vector: np.ndarray, k: int = 10) -> List[Tuple[str, float]]:
        """
        Search for k nearest neighbors.

        Args:
            query_vector: Query feature vector (dimension,) or (1, dimension)
            k: Number of neighbors to retrieve

        Returns:
            List of (fragment_id, distance) tuples
        """
        if len(self.fragment_ids) == 0:
            return []

        # Ensure query is 2D
        if query_vector.ndim == 1:
            query_vector = query_vector.reshape(1, -1)

        distances, indices = self.index.search(query_vector.astype(np.float32), k)

        results = []
        for dist, idx in zip(distances[0], indices[0]):
            if idx < len(self.fragment_ids) and idx >= 0:
                results.append((self.fragment_ids[idx], float(dist)))

        return results

    def search_batch(
        self, query_vectors: np.ndarray, k: int = 10
    ) -> List[List[Tuple[str, float]]]:
        """
        Batch search for multiple query vectors.

        Args:
            query_vectors: Query feature vectors (N x dimension)
            k: Number of neighbors per query

        Returns:
            List of result lists, one per query
        """
        if len(self.fragment_ids) == 0:
            return [[] for _ in range(len(query_vectors))]

        distances, indices = self.index.search(query_vectors.astype(np.float32), k)

        all_results = []
        for query_distances, query_indices in zip(distances, indices):
            results = []
            for dist, idx in zip(query_distances, query_indices):
                if idx < len(self.fragment_ids) and idx >= 0:
                    results.append((self.fragment_ids[idx], float(dist)))
            all_results.append(results)

        return all_results

    def save(self, path: str):
        """
        Save index to disk.

        Args:
            path: Path to save the index
        """
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        faiss.write_index(self.index, path)

        # Also save fragment IDs
        ids_path = path + ".ids.npy"
        np.save(ids_path, np.array(self.fragment_ids))

    def load(self, path: str):
        """
        Load index from disk.

        Args:
            path: Path to load the index from
        """
        self.index = faiss.read_index(path)
        self.is_trained = True

        # Load fragment IDs
        ids_path = path + ".ids.npy"
        if Path(ids_path).exists():
            self.fragment_ids = list(np.load(ids_path))

    def get_stats(self) -> dict:
        """
        Get index statistics.

        Returns:
            Dictionary with index statistics
        """
        return {
            "dimension": self.dimension,
            "index_type": self.index_type,
            "total_vectors": len(self.fragment_ids),
            "is_trained": self.is_trained,
            "nlist": self.nlist if self.index_type == "IVF" else None,
        }

    def reset(self):
        """Reset the index."""
        self._initialize_index()
        self.fragment_ids = []
        self.is_trained = False
