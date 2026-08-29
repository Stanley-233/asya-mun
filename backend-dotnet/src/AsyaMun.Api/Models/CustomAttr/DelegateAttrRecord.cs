namespace AsyaMun.Api.Models;

public class DelegateAttrRecord
{
    public Guid Id { get; set; }

    public DateTime CreatedAt { get; set; }

    public Guid? CreatedBy { get; set; }

    public DateTime UpdatedAt { get; set; }

    public Guid? UpdatedBy { get; set; }

    public Guid ConferenceId { get; set; }

    public Guid DelegateId { get; set; }

    public virtual Conference Conference { get; set; } = null!;

    public virtual User Delegate { get; set; } = null!;

    public virtual ICollection<DelegateAttrValue> DelegateAttrValues { get; set; } = new List<DelegateAttrValue>();
}