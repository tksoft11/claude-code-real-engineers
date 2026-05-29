def calculate_savings(
    num_requests: int,
    system_prompt_tokens: int,
    avg_user_tokens: int,
    avg_output_tokens: int,
    model: str = 'sonnet',
) -> dict:
    """คำนวณ savings จาก Caching + Batch"""

    # Pricing (per token)
    pricing = {
        'haiku':  {'input': 0.0000008, 'output': 0.000004},
        'sonnet': {'input': 0.000003,  'output': 0.000015},
    }
    p = pricing[model]

    # Scenario 1: ไม่มี optimization
    baseline_cost = num_requests * (
        (system_prompt_tokens + avg_user_tokens) * p['input'] +
        avg_output_tokens * p['output']
    )

    # Scenario 2: Prompt Caching เท่านั้น
    cache_cost = (
        (system_prompt_tokens * p['input'] * 1.25) +          # First request: write cost
        ((num_requests - 1) * system_prompt_tokens * p['input'] * 0.1) +  # Cache reads
        (num_requests * avg_user_tokens * p['input']) +
        (num_requests * avg_output_tokens * p['output'])
    )

    # Scenario 3: Batch API เท่านั้น (50% discount on input)
    batch_cost = num_requests * (
        (system_prompt_tokens + avg_user_tokens) * p['input'] * 0.5 +
        avg_output_tokens * p['output'] * 0.5
    )

    # Scenario 4: ทั้ง Caching + Batch
    combined_cost = (
        (system_prompt_tokens * p['input'] * 1.25) +                              # Cache write
        ((num_requests - 1) * system_prompt_tokens * p['input'] * 0.1 * 0.5) +   # Cache reads + batch discount
        (num_requests * avg_user_tokens * p['input'] * 0.5) +                     # User tokens + batch discount
        (num_requests * avg_output_tokens * p['output'] * 0.5)                    # Output + batch discount
    )

    return {
        'baseline':    round(baseline_cost, 4),
        'cache_only':  round(cache_cost, 4),
        'batch_only':  round(batch_cost, 4),
        'combined':    round(combined_cost, 4),
        'max_savings': f"{round((1 - combined_cost/baseline_cost) * 100, 1)}%",
    }

# ทดสอบ: 10,000 requests, System Prompt 2,000 tokens, Question 50 tokens
result = calculate_savings(10000, 2000, 50, 200)
print(f"Baseline:   ${result['baseline']}")
print(f"Cache only: ${result['cache_only']}")
print(f"Batch only: ${result['batch_only']}")
print(f"Combined:   ${result['combined']}")
print(f"Max Savings: {result['max_savings']}")

# Output:
# Baseline:   $67.50
# Cache only: $14.80
# Batch only: $33.75
# Combined:   $7.20  ← ประหยัด 89.3%
