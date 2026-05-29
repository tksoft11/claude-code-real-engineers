# check_batch_results.py
import anthropic
import json
from dotenv import load_dotenv

load_dotenv()
client = anthropic.Anthropic()

# อ่าน batch ID ที่บันทึกไว้
with open('batch_id.txt') as f:
    batch_id = f.read().strip()

# ตรวจ status
batch = client.beta.messages.batches.retrieve(batch_id)
print(f"Status: {batch.processing_status}")
print(f"Succeeded: {batch.request_counts.succeeded}")
print(f"Errored:   {batch.request_counts.errored}")

if batch.processing_status == 'ended':
    # ดึงผลลัพธ์
    results = {}
    for result in client.beta.messages.batches.results(batch_id):
        item_id = result.custom_id.replace('item-', '')

        if result.result.type == 'succeeded':
            sentiment = result.result.message.content[0].text.strip()
            results[item_id] = sentiment
        else:
            results[item_id] = 'ERROR'

    print(f"\nResults sample:")
    for item_id, sentiment in list(results.items())[:5]:
        print(f"  Item {item_id}: {sentiment}")

    # บันทึกผลลัพธ์
    with open('batch_results.json', 'w') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    print(f"\nSaved {len(results)} results to batch_results.json")
else:
    print("Batch not yet complete. Check again later.")
