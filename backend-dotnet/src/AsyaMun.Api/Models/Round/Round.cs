namespace AsyaMun.Api.Models;

public class Round
{
    public Guid Uuid { get; set; }

    public long DurationSeconds { get; set; }

    public DateTime? EndAt { get; set; }

    public bool IsCurrent { get; set; }

    public string Name { get; set; } = null!;

    public long RemainingSeconds { get; set; }

    public RoundStatus Status { get; set; }

    public DateTime UpdatedAt { get; set; }

    public Guid ConferenceId { get; set; }

    public Guid? NextRoundId { get; set; }

    public virtual Conference Conference { get; set; } = null!;

    public virtual ICollection<Round> InverseNextRound { get; set; } = new List<Round>();

    public virtual Round? NextRound { get; set; }
}