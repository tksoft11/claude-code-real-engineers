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
