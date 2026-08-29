using AsyaMun.Api.Models;

namespace AsyaMun.Api.Dtos;

public class DelegateAttrConfigCreateRequest
{
    public string AttrKey { get; init; } = string.Empty;

    public string AttrLabel { get; init; } = string.Empty;

    public DelegateAttrType? AttrType { get; init; }

    public int SortOrder { get; init; }

    public bool Enabled { get; init; } = true;

    public bool Visible { get; init; } = true;
}

public record DelegateAttrConfigUpdateRequest(
    string? AttrLabel,
    DelegateAttrType? AttrType,
    int? SortOrder,
    bool? Enabled,
    bool? Visible);

public record DelegateAttrConfigResponse(
    string Id,
    string AttrKey,
    string AttrLabel,
    DelegateAttrType AttrType,
    int SortOrder,
    bool Enabled,
    bool Visible);

public record DelegateAttrValueInput(string AttrKey, string? TextValue, decimal? NumberValue);

public class DelegateAttrRecordUpsertRequest
{
    public List<DelegateAttrValueInput> Values { get; init; } = new();
}

public record DelegateAttrFilterItem(string AttrKey, string? TextValue, decimal? NumberValue);

public record DelegateAttrManageQueryRequest(
    List<string>? DelegateIds,
    List<DelegateAttrFilterItem>? AttrFilters);

public record DelegateAttrTypedValueResponse(
    DelegateAttrType AttrType,
    string? TextValue,
    decimal? NumberValue);

public record DelegateAttrRecordResponse(
    string RecordId,
    string DelegateId,
    string DelegateName,
    DateTime UpdatedAt,
    Dictionary<string, DelegateAttrTypedValueResponse?> Values);

public record DelegateAttrRecordPageResponse(
    List<DelegateAttrConfigResponse> Configs,
    Page<DelegateAttrRecordResponse> Records);