# embeddings.py
from openai import OpenAI
import numpy as np

openai_client = OpenAI()  # ใช้ OpenAI สำหรับ embedding (ถูกกว่า)

def embed_text(text: str) -> list[float]:
    """แปลงข้อความเป็น vector"""
    response = openai_client.embeddings.create(
        input=text,
        model="text-embedding-3-small",  # $0.02/1M tokens — ถูกมาก
    )
    return response.data[0].embedding  # list of 1536 floats

def cosine_similarity(a: list[float], b: list[float]) -> float:
    """คำนวณความคล้ายกันระหว่าง 2 vectors"""
    a_arr, b_arr = np.array(a), np.array(b)
    return np.dot(a_arr, b_arr) / (np.linalg.norm(a_arr) * np.linalg.norm(b_arr))
