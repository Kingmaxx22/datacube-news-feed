Skip to content

# Free AI News API

Access curated AI news data from 35+ sources via REST API. Technology, investments, tips, videos — all in 8 languages, JSON format, no authentication required.

Start now — no API key needed View Documentation

REST API8 LanguagesJSON ResponseFree Tier

## What endpoints does the AI news API provide?

Our REST API gives you programmatic access to curated AI news data. Content endpoints return JSON with all available translations (up to 8 languages); /weeks returns the period list. Period IDs use the format YYYY-MM-DD (daily) or YYYY-kwWW (weekly).

GET`/api/weeks`

List all available periods (weeks with nested days)

GET`/api/tech/{periodId}`

Technology news + video summaries

GET`/api/investment/{periodId}`

Funding rounds, M&A, market news

GET`/api/tips/{periodId}`

Practical AI tips from Reddit + blogs

GET`/api/videos/{periodId}`

Curated YouTube video summaries

GET`/api/trends/{periodId}`

Trending AI topics

## How do I use the AI news API?

Get started in seconds with our API. Here are examples in three popular languages — no libraries, no setup, just a simple HTTP call:

### cURL
```

    curl -s https://api-production-3ee5.up.railway.app/api/tech/2026-02-26 | python -m json.tool

```

### JavaScript
```

    // Fetch AI tech news for a specific day
    const response = await fetch(
      'https://api-production-3ee5.up.railway.app/api/tech/2026-02-26'
    );
    const data = await response.json();
    
    // data.en = Array of English tech articles
    // data.de = Array of German tech articles
    // data.zh, data.fr, data.es, data.pt, data.ja, data.ko
    console.log(data.en[0].content);

```

### Python
```

    import json, urllib.request
    
    # Fetch AI tech news for a specific day (standard library only)
    with urllib.request.urlopen(
        'https://api-production-3ee5.up.railway.app/api/tech/2026-02-26'
    ) as response:
        data = json.load(response)
    
    # data['en'] = List of English tech articles
    # data['de'] = List of German tech articles
    for article in data['en']:
        print(article['content'])

```

## What does the API response look like?

Feed endpoints return multilingual JSON with all available translations (up to 8 languages). Here is an example of a typical response:
```

    {
      "de": [
        {
          "id": 1,
          "content": "OpenAI stellt GPT-5 vor...",
          "source": "TechCrunch",
          "category": "LLM",
          "impact": "high",
          "timestamp": "2026-02-26T14:30:00Z"
        }
      ],
      "en": [
        {
          "id": 1,
          "content": "OpenAI introduces GPT-5...",
          "source": "TechCrunch",
          "category": "LLM",
          "impact": "high",
          "timestamp": "2026-02-26T14:30:00Z"
        }
      ],
      "zh": [...],
      "fr": [...],
      "es": [...],
      "pt": [...],
      "ja": [...],
      "ko": [...]
    }

```

## Why use the Data Cube AI News API?

### No Auth Required

Free tier requires no API keys or registration. Simply call the endpoint and get data.

### 8 Language Data

Content endpoints include all available translations — up to 8 languages: German, English, Chinese, French, Spanish, Portuguese, Japanese, and Korean.

### 35+ Sources

Curated content from TechCrunch, MIT Technology Review, Ars Technica, Hacker News, Reddit, and YouTube.

### Stock Data (paused)

Stock data is paused while we review market-data licensing (stock endpoints return HTTP 410).

### Daily Updates

Data is automatically updated daily in the late evening (Berlin time). Weekly digests are also available.

### JSON Format

All responses are cleanly structured JSON. Easy to parse and ready to use directly in any application.

## Frequently Asked Questions

What is the AI news API?+

The Data Cube AI News API is a free REST interface that provides curated access to AI news data from 35+ sources. It delivers technology news, investment data, practical tips, and video summaries in 8 languages as JSON.

Is the API free?+

Yes, the API is free. The public endpoints require no authentication. Please use it fairly; for heavy commercial use, get in touch with us.

Do I need authentication?+

No — the public endpoints require no authentication and no API key. Just call the endpoints directly.

What data formats are supported?+

All endpoints return JSON. The content endpoints (tech/investment/tips/trends) organize data under language keys with up to 8 languages (DE, EN, ZH, FR, ES, PT, JA, KO); /weeks returns plain period objects.

How often is the data updated?+

Data is updated automatically every day in the late evening (Berlin time). Our pipeline collects, classifies, processes, and translates content from 35+ sources. Weekly digests are also available.

## More Free AI Tools

### [AI News Aggregator35+ sources, 8 languages, updated daily.](/en/tools/ai-news-aggregator)### [AI Report GeneratorStreaming reports, 5 export formats.](/en/tools/ai-report-generator)### [AI Stock TrackerPaused — licensing review in progress.](/en/tools/ai-stock-tracker)

[View All Tools ](/en/tools)

## Start Building with AI News Data

[Start now — no API key needed ](/en)[Read Full Docs](https://api-production-3ee5.up.railway.app/docs)

Trusted by developers worldwide