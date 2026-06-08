"""
Shared MiniLM-L6-v2 embedder for ChatSouq scrapers.

Uses the same model as packages/ai (all-MiniLM-L6-v2, 384d) so vectors written
here are directly compatible with the pgvector HNSW indexes queried by the AI.

Model is loaded once as a module-level singleton on first call (~90 MB download,
cached to ~/.cache/torch/sentence_transformers/ after first run).
"""
from sentence_transformers import SentenceTransformer

_model = None


def get_model() -> SentenceTransformer:
    global _model
    if _model is None:
        print("[embedder] Loading all-MiniLM-L6-v2 (first time — cached after this)...")
        _model = SentenceTransformer("all-MiniLM-L6-v2")
        print("[embedder] Ready.")
    return _model


def embed_batch(texts: list[str]) -> list[list[float]]:
    """Embed a list of strings. Returns one float-list per text."""
    model = get_model()
    vecs = model.encode(texts, normalize_embeddings=True, show_progress_bar=False)
    return vecs.tolist()


def embed_one(text: str) -> list[float]:
    return embed_batch([text])[0]


def to_pg_vector(v: list[float]) -> str:
    """Format a float list as a Postgres vector literal: '[0.123,...,0.456]'."""
    return "[" + ",".join(f"{x:.6f}" for x in v) + "]"
