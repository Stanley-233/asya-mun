namespace AsyaMun.Api.Models;

public class Attachment
{
    public Guid Uuid { get; set; }

    public uint FileBlob { get; set; }

    public string FileName { get; set; } = null!;

    public long FileSize { get; set; }

    public string FileType { get; set; } = null!;

    public Guid? TargetId { get; set; }

    public AttachmentTargetType? TargetType { get; set; }

    public Guid? MessageId { get; set; }

    public virtual Message? Message { get; set; }
}