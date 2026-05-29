# src/computer_use/screenshot.py
import subprocess
import base64
from PIL import ImageGrab  # Windows/Mac

def take_screenshot() -> str:
    """ถ่าย screenshot และ return เป็น base64"""
    screenshot = ImageGrab.grab()
    
    # Resize ถ้าหน้าจอใหญ่เกินไป (ลด token)
    max_width = 1366
    if screenshot.width > max_width:
        ratio = max_width / screenshot.width
        new_height = int(screenshot.height * ratio)
        screenshot = screenshot.resize((max_width, new_height))
    
    import io
    buffer = io.BytesIO()
    screenshot.save(buffer, format='PNG')
    return base64.standard_b64encode(buffer.getvalue()).decode()
