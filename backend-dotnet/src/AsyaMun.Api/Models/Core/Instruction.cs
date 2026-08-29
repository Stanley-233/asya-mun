namespace AsyaMun.Api.Models;

public class Instruction
{
    public Guid Uuid { get; set; }

    public string InstructionContent { get; set; } = null!;

    public InstructionType InstructionType { get; set; }

    public string? ReviewComment { get; set; }

    public string? ReviewedGameTime { get; set; }

    public DateTime? ReviewedRealTime { get; set; }

    public string SubmitGameTime { get; set; } = null!;

    public DateTime SubmitRealTime { get; set; }

    public InstructionStatus Status { get; set; }

    public string Title { get; set; } = null!;

    public Guid ConferenceId { get; set; }

    public Guid? ReviewedBy { get; set; }

    public Guid SubmitterId { get; set; }

    public virtual Conference Conference { get; set; } = null!;

    public virtual User? ReviewedByNavigation { get; set; }

    public virtual User Submitter { get; set; } = null!;
}