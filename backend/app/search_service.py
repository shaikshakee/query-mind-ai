from ddgs import DDGS

def search_web(query: str, news: bool = False) -> str:
    try:
        with DDGS() as ddgs:
            results = list(ddgs.news(query, max_results=5) if news else ddgs.text(query, max_results=5))
        return "\n\n".join(
            f"Title: {item.get('title','')}\nDate: {item.get('date','')}\nURL: {item.get('url', item.get('href',''))}\nSnippet: {item.get('body','')}"
            for item in results
        )
    except Exception as exc:
        print("Web search unavailable:", type(exc).__name__)
        return ""

def needs_web(question: str) -> bool:
    terms = ("latest","today","currently","right now","this week","recent news","breaking news","weather","stock price","exchange rate","current news","latest version")
    q = question.lower()
    return any(term in q for term in terms)
