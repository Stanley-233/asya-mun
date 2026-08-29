namespace AsyaMun.Api.Models;

public class DelegateAttrValue
{
    public Guid Id { get; set; }

    public decimal? ValueNumber { get; set; }

    public string? ValueText { get; set; }

    public Guid AttrConfigId { get; set; }

    public Guid RecordId { get; set; }

    public virtual DelegateAttrConfig AttrConfig { get; set; } = null!;

    public virtual DelegateAttrRecord Record { get; set; } = null!;
}