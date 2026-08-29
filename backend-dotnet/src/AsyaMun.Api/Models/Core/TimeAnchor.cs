namespace AsyaMun.Api.Models;

public class TimeAnchor
{
    public long Id { get; set; }

    public string? AnchorGameTime { get; set; }

    public DateTime? AnchorRealTime { get; set; }

    public bool IsCurrent { get; set; }

    public decimal? TimeRatio { get; set; }

    public DateTime? UpdateTime { get; set; }

    public Guid ConferenceId { get; set; }

    public virtual Conference Conference { get; set; } = null!;
}