using AsyaMun.Core.Pagination;

namespace AsyaMun.Api.Http;

public static class PageInputParser
{
    public static PageInput Parse(HttpRequest request, int defaultSize = 20)
    {
        int page = 0;
        int size = defaultSize;
        var sort = new List<SortSpec>();

        if (int.TryParse(request.Query["page"], out var p))
        {
            page = Math.Max(0, p);
        }

        if (int.TryParse(request.Query["pageSize"], out var ps))
        {
            size = Math.Max(1, ps);
        }
        else if (int.TryParse(request.Query["size"], out var s))
        {
            size = Math.Max(1, s);
        }

        // Kotlin 兼容：current / pageNum 为 1-based，覆盖 page
        if (int.TryParse(request.Query["current"], out var current))
        {
            page = Math.Max(0, current - 1);
        }
        else if (int.TryParse(request.Query["pageNum"], out var pageNum))
        {
            page = Math.Max(0, pageNum - 1);
        }

        foreach (var raw in request.Query["sort"])
        {
            if (string.IsNullOrWhiteSpace(raw))
            {
                continue;
            }

            var parts = raw.Split(',');
            var field = parts[0].Trim();
            if (field.Length == 0)
            {
                continue;
            }

            var descending = parts.Length > 1 && string.Equals(parts[1].Trim(), "desc", StringComparison.OrdinalIgnoreCase);
            sort.Add(new SortSpec(field, descending));
        }

        return new PageInput { Page = page, Size = size, Sort = sort };
    }
}
