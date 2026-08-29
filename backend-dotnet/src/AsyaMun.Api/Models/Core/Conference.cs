namespace AsyaMun.Api.Models;

public class Conference
{
    public Guid Uuid { get; set; }

    public string Description { get; set; } = null!;

    public string Name { get; set; } = null!;

    public ConferenceStatus Status { get; set; }

    public bool InstructionSubmissionPaused { get; set; }

    public virtual ICollection<DelegateAttrConfig> DelegateAttrConfigs { get; set; } = new List<DelegateAttrConfig>();

    public virtual ICollection<DelegateAttrRecord> DelegateAttrRecords { get; set; } = new List<DelegateAttrRecord>();

    public virtual ICollection<Instruction> Instructions { get; set; } = new List<Instruction>();

    public virtual ICollection<Message> Messages { get; set; } = new List<Message>();

    public virtual Round? Round { get; set; }

    public virtual TimeAnchor? TimeAnchor { get; set; }

    public virtual ICollection<User> Users { get; set; } = new List<User>();
}