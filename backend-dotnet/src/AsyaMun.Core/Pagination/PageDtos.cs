namespace AsyaMun.Core.Pagination;

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

}
