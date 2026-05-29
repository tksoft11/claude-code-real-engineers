# simple_rag.py — RAG ที่เริ่มต้นได้ใน 50 บรรทัด
import chromadb
from openai import OpenAI
import anthropic
from dotenv import load_dotenv

load_dotenv()

openai_client = OpenAI()
claude_client = anthropic.Anthropic()

# สร้าง ChromaDB (เก็บใน memory หรือ disk)
chroma = chromadb.Client()
collection = chroma.create_collection("company_docs")


def add_document(doc_id: str, text: str, metadata: dict = {}):
    """เพิ่มเอกสารเข้า Vector DB"""
    # Chunk เอกสารยาวๆ
    chunks = chunk_text(text, chunk_size=500, overlap=50)

    for i, chunk in enumerate(chunks):
        # Embed chunk
        embedding = openai_client.embeddings.create(
            input=chunk, model="text-embedding-3-small"
        ).data[0].embedding

        collection.add(
            ids=[f"{doc_id}_chunk_{i}"],
            embeddings=[embedding],
            documents=[chunk],
            metadatas=[{**metadata, "chunk_index": i, "source": doc_id}],
        )

    print(f"✅ Added {len(chunks)} chunks from '{doc_id}'")


def search(query: str, n_results: int = 3) -> list[dict]:
    """ค้นหา chunks ที่เกี่ยวข้องกับ query"""
    query_embedding = openai_client.embeddings.create(
        input=query, model="text-embedding-3-small"
    ).data[0].embedding

    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=n_results,
    )

    return [
        {
            "text": doc,
            "source": meta.get("source", "unknown"),
            "score": 1 - dist,  # convert distance to similarity
        }
        for doc, meta, dist in zip(
            results["documents"][0],
            results["metadatas"][0],
            results["distances"][0],
        )
    ]


def rag_query(user_question: str) -> str:
    """ถาม Claude โดยใช้ RAG"""
    # 1. ค้นหาข้อมูลที่เกี่ยวข้อง
    relevant_chunks = search(user_question, n_results=3)

    if not relevant_chunks:
        return "ไม่พบข้อมูลที่เกี่ยวข้อง"

    # 2. สร้าง context จาก chunks
    context = "\n\n".join([
        f"[จาก: {chunk['source']}]\n{chunk['text']}"
        for chunk in relevant_chunks
    ])

    print(f"📚 Retrieved {len(relevant_chunks)} relevant chunks")
    print(f"   Sources: {[c['source'] for c in relevant_chunks]}")

    # 3. ส่ง Claude พร้อม context
    response = claude_client.messages.create(
        model="claude-haiku-4-5",
        max_tokens=1024,
        system="""คุณคือ AI ผู้ช่วยของบริษัท
ตอบคำถามโดยอ้างอิงจาก Context ที่ให้มาเท่านั้น
ถ้าข้อมูลใน Context ไม่เพียงพอ ให้บอกตรงๆ
ตอบเป็นภาษาไทย""",
        messages=[
            {
                "role": "user",
                "content": f"""Context ที่เกี่ยวข้อง:
{context}

คำถาม: {user_question}""",
            }
        ],
    )

    return response.content[0].text


def chunk_text(text: str, chunk_size: int = 500, overlap: int = 50) -> list[str]:
    """แบ่งข้อความเป็น chunks"""
    words = text.split()
    chunks = []
    i = 0
    while i < len(words):
        chunk = " ".join(words[i : i + chunk_size])
        chunks.append(chunk)
        i += chunk_size - overlap
    return chunks


# ===== ทดสอบ =====
# เพิ่มเอกสารบริษัท
add_document("leave_policy", """
นโยบายการลาของบริษัท ABC:

วันลาพักร้อน: พนักงานมีสิทธิ์ลาพักร้อน 10 วันต่อปี สำหรับพนักงานที่ทำงานครบ 1 ปี
พนักงานที่ทำงานไม่ถึง 1 ปี จะได้รับวันลาตามสัดส่วน

วันลาป่วย: พนักงานมีสิทธิ์ลาป่วยได้ 30 วันต่อปีโดยได้รับค่าจ้างปกติ
ต้องแสดงใบรับรองแพทย์เมื่อลาป่วยตั้งแต่ 3 วันขึ้นไป
""", {"category": "HR", "topic": "leave"})

add_document("it_policy", """
นโยบาย IT Security ของบริษัท:

Password: รหัสผ่านต้องมีอย่างน้อย 12 ตัวอักษร ประกอบด้วยตัวอักษรพิมพ์ใหญ่ พิมพ์เล็ก ตัวเลข และสัญลักษณ์
ต้องเปลี่ยนรหัสผ่านทุก 90 วัน

Software: ห้ามติดตั้งซอฟต์แวร์ที่ไม่ได้รับอนุมัติจาก IT
ต้องแจ้ง IT helpdesk ก่อนติดตั้งซอฟต์แวร์ใดๆ บนคอมพิวเตอร์บริษัท
""", {"category": "IT", "topic": "security"})

# ถามคำถาม
print("\n" + "="*50)
answer = rag_query("ลาพักร้อนได้กี่วัน?")
print(f"\n📝 Answer:\n{answer}")

print("\n" + "="*50)
answer2 = rag_query("รหัสผ่านต้องยาวเท่าไหร่?")
print(f"\n📝 Answer:\n{answer2}")
