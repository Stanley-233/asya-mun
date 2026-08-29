namespace AsyaMun.Api.Models;

public class Message
{
    public Guid Uuid { get; set; }

    public string? Brief { get; set; }

    public string? MsgContent { get; set; }

    public bool IsSecret { get; set; }

    public MessageType? MsgType { get; set; }

    public string PublishGameTime { get; set; } = null!;

    public DateTime PublishRealTime { get; set; }

    public string? Title { get; set; }

    public Guid ConferenceId { get; set; }

    public Guid? SenderId { get; set; }

    public virtual ICollection<Attachment> Attachments { get; set; } = new List<Attachment>();

    public virtual Conference Conference { get; set; } = null!;

    public virtual ICollection<MessageReceiver> MessageReceivers { get; set; } = new List<MessageReceiver>();

    public virtual User? Sender { get; set; }
}