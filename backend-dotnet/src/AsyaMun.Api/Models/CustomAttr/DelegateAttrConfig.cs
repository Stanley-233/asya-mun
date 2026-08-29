namespace AsyaMun.Api.Models;

public class DelegateAttrConfig
{
    public Guid Id { get; set; }

    public string AttrKey { get; set; } = null!;

    public string AttrLabel { get; set; } = null!;

    public DelegateAttrType AttrType { get; set; }

    public DateTime CreatedAt { get; set; }

    public Guid? CreatedBy { get; set; }

    public bool Enabled { get; set; }

    public int SortOrder { get; set; }

    public DateTime UpdatedAt { get; set; }

    public Guid? UpdatedBy { get; set; }

    public Guid ConferenceId { get; set; }

    public bool Visible { get; set; }

    public virtual Conference Conference { get; set; } = null!;

    public virtual ICollection<DelegateAttrValue> DelegateAttrValues { get; set; } = new List<DelegateAttrValue>();
}