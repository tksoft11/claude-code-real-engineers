# browser_agent.py — สำหรับ web-only tasks
from playwright.sync_api import sync_playwright
import anthropic
import base64

def run_browser_agent(task: str, start_url: str):
    client = anthropic.Anthropic()
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        page = browser.new_page(viewport={"width": 1366, "height": 768})
        page.goto(start_url)
        page.wait_for_load_state('networkidle')
        
        messages = []
        
        def get_screenshot() -> str:
            screenshot_bytes = page.screenshot()
            return base64.standard_b64encode(screenshot_bytes).decode()
        
        # Initial screenshot
        messages.append({
            "role": "user",
            "content": [
                {"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": get_screenshot()}},
                {"type": "text", "text": f"ทำงานต่อไปนี้:\n{task}"}
            ]
        })
        
        for _ in range(100):
            response = client.messages.create(
                model="claude-opus-4-5",
                max_tokens=4096,
                tools=[{"type": "computer_20241022", "name": "computer", "display_width_px": 1366, "display_height_px": 768}],
                messages=messages,
            )
            
            if response.stop_reason == "end_turn":
                break
            
            messages.append({"role": "assistant", "content": response.content})
            tool_results = []
            
            for block in response.content:
                if block.type != "tool_use":
                    continue
                
                action = block.input
                action_type = action.get("action")
                
                if action_type == "screenshot":
                    pass  # จะถ่ายหลังทุก action อยู่แล้ว
                elif action_type == "left_click":
                    x, y = action["coordinate"]
                    page.mouse.click(x, y)
                    page.wait_for_timeout(500)
                elif action_type == "type":
                    page.keyboard.type(action["text"])
                elif action_type == "key":
                    page.keyboard.press(action["text"])
                elif action_type == "scroll":
                    x, y = action["coordinate"]
                    page.mouse.wheel(0, 100 if action.get("direction") == "down" else -100)
                
                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": [{"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": get_screenshot()}}]
                })
            
            if tool_results:
                messages.append({"role": "user", "content": tool_results})
        
        browser.close()
