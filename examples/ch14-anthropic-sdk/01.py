# Python — โหลดจาก .env
from dotenv import load_dotenv
import os

load_dotenv()
# SDK จะอ่าน ANTHROPIC_API_KEY จาก environment อัตโนมัติ
client = anthropic.Anthropic()  # ไม่ต้องใส่ api_key!
