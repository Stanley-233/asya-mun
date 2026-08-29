namespace AsyaMun.Api.Models;

public class User
{
    public Guid Uuid { get; set; }

    public string? DisplayName { get; set; }

    public string Name { get; set; } = null!;

    public string Password { get; set; } = null!;

    public UserRole Role { get; set; }

    public Guid? ConferenceId { get; set; }

    public int AuthVersion { get; set; }

    public virtual Conference? Conference { get; set; }

    public virtual ICollection<DelegateAttrRecord> DelegateAttrRecords { get; set; } = new List<DelegateAttrRecord>();

    public virtual ICollection<Instruction> InstructionReviewedByNavigations { get; set; } = new List<Instruction>();

    public virtual ICollection<Instruction> InstructionSubmitters { get; set; } = new List<Instruction>();

    public virtual ICollection<MessageReceiver> MessageReceivers { get; set; } = new List<MessageReceiver>();

    public virtual ICollection<Message> Messages { get; set; } = new List<Message>();

    public virtual ICollection<UserGroup> Groups { get; set; } = new List<UserGroup>();
}