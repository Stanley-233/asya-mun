namespace AsyaMun.Api.Models;

public class MessageReceiver
{
    public DateTime ReadableAt { get; set; }

    public Guid MessageId { get; set; }

    public Guid UserId { get; set; }

    public virtual Message Message { get; set; } = null!;

    public virtual User User { get; set; } = null!;
}