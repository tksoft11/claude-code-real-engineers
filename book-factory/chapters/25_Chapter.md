# บทที่ 25: Memory Management & Vector DB — Context Window vs RAG

---

## 🪝 AI ที่จำอะไรไม่ได้เลย

ทีม Customer Service ของบริษัทใช้ Claude ตอบคำถามลูกค้า โดยมีเอกสารบริษัทกว่า 500 หน้า

วิธีที่ทีมทำ: copy เอกสารทั้งหมด → วาง system prompt → ถาม

ผลลัพธ์:
- เอกสาร 500 หน้า ≈ 400,000 tokens
- Claude Sonnet รองรับได้ 200,000 tokens
- **ครึ่งเอกสารหายไป** Claude ตอบด้วยข้อมูลครึ่งเดียว

และแม้จะใช้ Model ที่ context ใหญ่กว่า:
- ค่า API ต่อ request สูงมาก (ส่ง 400,000 tokens ทุกครั้ง)
- Response ช้าลง เพราะต้องอ่านทุกอย่างทุกครั้ง

**RAG (Retrieval Augmented Generation)** แก้ปัญหานี้ — แทนที่จะส่งเอกสารทั้งหมด ส่งแค่ส่วนที่เกี่ยวข้องกับคำถามนั้นๆ

---

## 🧠 ประเภทของ AI Memory

```
                    ┌──────────────────────────────────┐
                    │         AI Memory Types          │
                    └──────────────────────────────────┘
                                    │
         ┌──────────────────────────┼──────────────────────────┐
         │                          │                          │
┌────────▼────────┐     ┌──────────▼──────────┐   ┌──────────▼──────────┐
│  In-Context     │     │  External Memory    │   │  Parametric Memory  │
│  Memory         │     │  (Vector DB / RAG)  │   │  (ใน Model weights) │
├─────────────────┤     ├─────────────────────┤   ├─────────────────────┤
│ คือ Context     │     │ คือ Database ที่     │   │ สิ่งที่ Claude      │
│ Window ปัจจุบัน │     │ ค้นหาได้ก่อนส่ง     │   │ "รู้" จาก training  │
│                 │     │ ให้ Claude           │   │                     │
│ ✅ เร็ว          │     │ ✅ Scale ได้ไม่จำกัด│   │ ✅ ไม่ต้องส่งใหม่  │
│ ✅ Accurate     │     │ ✅ ประหยัด token    │   │ ❌ ล้าสมัย          │
│ ❌ จำกัดขนาด    │     │ ✅ Update ได้        │   │ ❌ ไม่รู้ข้อมูลใหม่ │
│ ❌ แพง          │     │ ❌ ต้องตั้ง infra    │   │ ❌ อาจ hallucinate  │
└─────────────────┘     └─────────────────────┘   └─────────────────────┘
```

---

## 📏 Context Window: ขีดจำกัดที่ต้องรู้

```
Model          Context Window    เหมาะกับ
─────────────────────────────────────────────────────
Claude Haiku   200K tokens       เอกสาร ~150,000 คำ
Claude Sonnet  200K tokens       หนังสือ ~4-5 เล่ม
Claude Opus    200K tokens       เอกสารขนาดกลาง

200K tokens ≈ 150,000 คำภาษาอังกฤษ ≈ 100,000 คำภาษาไทย

─────────────────────────────────────────────────────
ดูเหมือนเยอะ แต่...

เอกสาร 500 หน้า    ≈ 400,000 tokens  ← เกิน context
Codebase 10,000 ไฟล์ ≈ ไม่มีทางใส่ได้ทั้งหมด
Knowledge Base บริษัท ≈ หลายล้าน tokens
```

**นอกจาก size ยังมีปัญหา "Lost in the Middle":**

```
Context ที่ยาวมาก:
[ข้อมูลส่วนต้น] [ข้อมูลกลาง] [ข้อมูลส่วนท้าย]
      ↑ Claude จำได้ดี   ↑ จำได้แย่ที่สุด   ↑ Claude จำได้ดี

งานวิจัยพบว่า ข้อมูลที่อยู่กลาง context มักถูกละเลย
แม้จะส่งไปก็ตาม!
```

---

## 🔍 RAG: ส่งแค่สิ่งที่เกี่ยวข้อง

```
ไม่มี RAG:
คำถาม → [เอกสารทั้งหมด 500 หน้า + คำถาม] → Claude → คำตอบ
         (ส่ง 400,000 tokens ทุกครั้ง!)

มี RAG:
คำถาม → ค้นหาใน Vector DB → [แค่ 5 หน้าที่เกี่ยวข้อง + คำถาม] → Claude → คำตอบ
                              (ส่งแค่ ~5,000 tokens!)

ประหยัด: 98.75% ของ input tokens
```

### RAG Pipeline ทีละขั้นตอน

```
Phase 1: Indexing (ทำครั้งเดียว)
─────────────────────────────────
เอกสาร → แบ่งเป็น Chunks → Embed เป็น Vectors → เก็บใน Vector DB

Phase 2: Retrieval + Generation (ทำทุก query)
──────────────────────────────────────────────
คำถาม → Embed เป็น Vector → ค้นหา Vectors ที่ใกล้ที่สุด → ดึง Chunks กลับมา
       → รวม Chunks เป็น Context → ส่ง Claude → คำตอบ
```

---

## 🧮 Vector Embeddings: เข้าใจในนาทีเดียว

Embedding คือการแปลงข้อความเป็นตัวเลข (vector) ที่ข้อความที่ "หมายความใกล้กัน" จะมี vectors ใกล้กัน:

```python
# ตัวอย่าง embedding (ในความเป็นจริง มี 1,536 มิติ ไม่ใช่ 3 มิติ)

"วิธีคืนสินค้า"         → [0.82, 0.15, 0.73, ...]
"ขั้นตอนการ return item" → [0.81, 0.14, 0.72, ...]  ← ใกล้กันมาก!
"ราคาสินค้า"            → [0.21, 0.89, 0.12, ...]  ← ห่างกัน

เมื่อลูกค้าถาม "คืนของยังไง" → embed → ค้นหา vector ที่ใกล้ที่สุด
→ เจอ "วิธีคืนสินค้า" และ "ขั้นตอนการ return item"
→ ส่ง chunks เหล่านั้นให้ Claude → Claude ตอบได้ถูกต้อง
```

### สร้าง Embedding ด้วย OpenAI (ราคาถูกที่สุด)

```python
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
```

---

## 🗄️ Vector Database Options

```
┌──────────────┬─────────────────────────────────────────────────┐
│  Database    │  เหมาะกับ                                        │
├──────────────┼─────────────────────────────────────────────────┤
│ pgvector     │ ✅ มี PostgreSQL อยู่แล้ว → เพิ่ม extension      │
│              │ ✅ SQL ปกติ ไม่ต้องเรียนรู้ใหม่                 │
│              │ ✅ Production-ready, ถูก                         │
│              │ เหมาะกับ: โปรเจกต์ที่มี PostgreSQL อยู่แล้ว    │
├──────────────┼─────────────────────────────────────────────────┤
│ Pinecone     │ ✅ Managed (ไม่ต้อง maintain)                   │
│              │ ✅ Scale ได้ไม่จำกัด                             │
│              │ ✅ API ง่ายมาก                                   │
│              │ เหมาะกับ: Production ที่ต้องการ scale           │
├──────────────┼─────────────────────────────────────────────────┤
│ ChromaDB     │ ✅ ฟรี Open Source                              │
│              │ ✅ ใช้ในเครื่องได้เลย                           │
│              │ ✅ Python API ง่าย                              │
│              │ เหมาะกับ: Development, Prototype               │
├──────────────┼─────────────────────────────────────────────────┤
│ Weaviate     │ ✅ Built-in vectorization                       │
│              │ ✅ Multi-modal (text + image)                   │
│              │ เหมาะกับ: Enterprise ที่ต้องการ features ครบ   │
└──────────────┴─────────────────────────────────────────────────┘
```

---

## 💻 Minimal RAG ด้วย ChromaDB (ทดสอบในเครื่อง)

```bash
pip install chromadb openai anthropic python-dotenv
```

```python
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
```

---

## 📐 Chunking Strategies (สำคัญมาก)

```python
# วิธีแบ่ง document — ส่งผลต่อ retrieval quality มาก

# Strategy 1: Fixed-size chunks (ง่ายแต่อาจตัดกลางประโยค)
def fixed_chunk(text: str, size: int = 500) -> list[str]:
    words = text.split()
    return [" ".join(words[i:i+size]) for i in range(0, len(words), size)]

# Strategy 2: Sentence-based (ดีกว่า — ไม่ตัดกลางประโยค)
import re
def sentence_chunk(text: str, max_chars: int = 1000) -> list[str]:
    sentences = re.split(r'(?<=[.!?])\s+', text)
    chunks, current = [], ""
    for sent in sentences:
        if len(current) + len(sent) < max_chars:
            current += " " + sent
        else:
            if current: chunks.append(current.strip())
            current = sent
    if current: chunks.append(current.strip())
    return chunks

# Strategy 3: Semantic chunking (ดีที่สุด — แบ่งตาม meaning)
# แบ่งที่หัวข้อ, ย่อหน้า, หรือตาม semantic similarity ของประโยค
def heading_chunk(markdown_text: str) -> list[dict]:
    sections = re.split(r'\n#+\s', markdown_text)
    return [{"text": s.strip(), "type": "section"} for s in sections if s.strip()]
```

---

## 🎯 สรุปบทที่ 25

| หัวข้อ | สิ่งที่ต้องจำ |
|--------|--------------|
| Context Window | จำกัด, แพง, "Lost in the Middle" |
| RAG ช่วยอะไร | ส่งแค่ส่วนที่เกี่ยวข้อง → ถูกกว่า 98% |
| Embedding | ข้อความ → Vector → ค้นหาตาม "ความหมาย" |
| Vector DB | pgvector (SQL), ChromaDB (dev), Pinecone (prod) |
| Chunking | ส่งผลต่อ quality มาก — sentence-based ดีกว่า fixed-size |
| Minimal RAG | ChromaDB + OpenAI Embedding + Claude = 50 บรรทัด |

---

## 📋 Action Items ก่อนไปบทที่ 26

- [ ] ติดตั้ง ChromaDB และ OpenAI SDK
- [ ] รัน `simple_rag.py` กับเอกสารบริษัทจริง
- [ ] ทดสอบ chunking strategies ต่างๆ เปรียบเทียบคุณภาพ
- [ ] วัด token ที่ใช้: RAG vs ส่งเอกสารทั้งหมด
- [ ] ระบุ use cases ในงานที่ RAG จะช่วยได้

---

*ใน **บทที่ 26** เราจะลง hands-on สร้าง RAG Pipeline เต็มรูปแบบ — "The Company Brain" ที่ตอบคำถามจากเอกสารบริษัทจริง ด้วย pgvector + Prisma + Claude แบบ Production-ready ครับ*
