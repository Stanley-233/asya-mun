namespace AsyaMun.Api.Dtos;

public record SortDto(bool Sorted, bool Unsorted, bool Empty);

public record PageableDto(SortDto Sort, long Offset, int PageNumber, int PageSize, bool Paged, bool Unpaged);

public class Page<T>
{
    public List<T> Content { get; set; } = new();

    public int Number { get; set; }

    public int Size { get; set; }

    public long TotalElements { get; set; }

    public int TotalPages { get; set; }

    public int NumberOfElements { get; set; }

    public bool First { get; set; }

    public bool Last { get; set; }

    public bool Empty { get; set; }

    public SortDto Sort { get; set; } = new(false, true, true);

    public PageableDto Pageable { get; set; } = new(new SortDto(false, true, true), 0, 0, 0, true, false);

    public static Page<T> Of(IReadOnlyList<T> content, int pageNumber, int pageSize, long totalElements)
    {
        var totalPages = (int)Math.Ceiling(totalElements / (double)Math.Max(1, pageSize));
        var numberOfElements = content.Count;
        return new Page<T>
        {
            Content = content.ToList(),
            Number = pageNumber,
            Size = pageSize,
            TotalElements = totalElements,
            TotalPages = totalPages,
            NumberOfElements = numberOfElements,
            First = pageNumber == 0,
            Last = pageNumber >= Math.Max(0, totalPages - 1),
            Empty = numberOfElements == 0,
            Sort = new SortDto(false, true, true),
            Pageable = new PageableDto(new SortDto(false, true, true), (long)pageNumber * pageSize, pageNumber, pageSize, true, false)
        };
    }
}

public readonly record struct SortSpec(string Property, bool Descending);

public class PageInput
{
    public int Page { get; init; }

    public int Size { get; init; }

    public List<SortSpec> Sort { get; init; } = new();

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