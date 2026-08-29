using System.Data;
using AsyaMun.Api.Data;
using AsyaMun.Api.Dtos;
using AsyaMun.Api.Errors;
using AsyaMun.Api.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace AsyaMun.Api.Services;

public class AttachmentService
{
    private const string FallbackName = "unknown";
    private const string FallbackType = "bin";

    private readonly AppDbContext _db;

    public AttachmentService(AppDbContext db)
    {
        _db = db;
    }

    public async Task<AttachmentUploadResponse> UploadAttachmentAsync(IFormFile file, CancellationToken ct = default)
    {
        return await UploadAttachmentAsync(file, null, null, ct);
    }

    public async Task<AttachmentUploadResponse> UploadAttachmentAsync(
        IFormFile file,
        AttachmentTargetType? targetType,
        Guid? targetId,
        CancellationToken ct = default)
    {
        if (file.Length == 0)
        {
            throw new AsyaBusinessException(BizCode.PARAM_ERROR, "文件为空");
        }

        var (fileName, fileType) = SplitFileName(file.FileName);
        var bytes = new byte[file.Length];
        await using (var stream = file.OpenReadStream())
        {
            await stream.ReadExactlyAsync(bytes.AsMemory(), ct);
        }

        var oid = await StoreBlobAsync(bytes, ct);

        var attachment = new Attachment
        {
            Uuid = Guid.NewGuid(),
            FileName = fileName,
            FileType = fileType,
            FileSize = file.Length,
            FileBlob = oid,
            TargetType = targetType,
            TargetId = targetId
        };

        _db.Attachments.Add(attachment);
        await _db.SaveChangesAsync(ct);

        return new AttachmentUploadResponse(
            attachment.Uuid.ToString("D"),
            attachment.FileName,
            attachment.FileType);
    }

    public async Task<List<AttachmentInfoResponse>> ListAllAsync(CancellationToken ct = default)
    {
        var attachments = await _db.Attachments.AsNoTracking().ToListAsync(ct);
        return attachments.Select(ToInfoResponse).ToList();
    }

    public async Task<AttachmentInfoResponse> GetAttachmentInfoAsync(Guid uuid, CancellationToken ct = default)
    {
        return ToInfoResponse(await GetAttachmentAsync(uuid, ct));
    }

    public async Task<Attachment> GetAttachmentAsync(Guid uuid, CancellationToken ct = default)
    {
        return await _db.Attachments.AsNoTracking().FirstOrDefaultAsync(a => a.Uuid == uuid, ct)
            ?? throw new AsyaBusinessException(BizCode.PARAM_ERROR, $"Attachment not found: {uuid}");
    }

    public async Task DeleteAttachmentAsync(Guid uuid, CancellationToken ct = default)
    {
        var attachment = await _db.Attachments.FirstOrDefaultAsync(a => a.Uuid == uuid, ct);
        if (attachment == null)
        {
            throw new AsyaBusinessException(BizCode.PARAM_ERROR, $"Attachment not found: {uuid}");
        }

        _db.Attachments.Remove(attachment);
        await _db.SaveChangesAsync(ct);
    }

    public async Task<byte[]> ReadBlobAsync(uint oid, CancellationToken ct = default)
    {
        var conn = (NpgsqlConnection)_db.Database.GetDbConnection();
        var wasClosed = conn.State != ConnectionState.Open;
        if (wasClosed)
        {
            await conn.OpenAsync(ct);
        }

        try
        {
            await using var cmd = new NpgsqlCommand("select lo_get(@oid)", conn);
            cmd.Parameters.AddWithValue("@oid", oid);
            var value = await cmd.ExecuteScalarAsync(ct);

            return value switch
            {
                byte[] bytes => bytes,
                null => Array.Empty<byte>(),
                _ => throw new InvalidOperationException("附件内容读取失败")
            };
        }
        finally
        {
            if (wasClosed)
            {
                await conn.CloseAsync();
            }
        }
    }

    private async Task<uint> StoreBlobAsync(byte[] bytes, CancellationToken ct)
    {
        var conn = (NpgsqlConnection)_db.Database.GetDbConnection();
        var wasClosed = conn.State != ConnectionState.Open;
        if (wasClosed)
        {
            await conn.OpenAsync(ct);
        }

        try
        {
            await using var cmd = new NpgsqlCommand("select lo_from_bytea(0, @data)", conn);
            cmd.Parameters.AddWithValue("@data", bytes);
            var result = await cmd.ExecuteScalarAsync(ct);

            return Convert.ToUInt32(result);
        }
        finally
        {
            if (wasClosed)
            {
                await conn.CloseAsync();
            }
        }
    }

    private static (string Name, string Type) SplitFileName(string? originalFilename)
    {
        var rawName = string.IsNullOrWhiteSpace(originalFilename) ? FallbackName : originalFilename;
        var slashIndex = rawName.LastIndexOf('/');
        var normalized = slashIndex >= 0 ? rawName[(slashIndex + 1)..] : rawName;
        var backslashIndex = normalized.LastIndexOf('\\');
        normalized = backslashIndex >= 0 ? normalized[(backslashIndex + 1)..] : normalized;

        var dotIndex = normalized.LastIndexOf('.');
        if (dotIndex <= 0 || dotIndex == normalized.Length - 1)
        {
            return (normalized, FallbackType);
        }

        return (normalized[..dotIndex], normalized[(dotIndex + 1)..]);
    }

    private static AttachmentInfoResponse ToInfoResponse(Attachment attachment)
    {
        return new AttachmentInfoResponse(
            attachment.Uuid.ToString("D"),
            attachment.FileName,
            attachment.FileType,
            attachment.FileSize,
            attachment.TargetType,
            attachment.TargetId?.ToString("D"),
            attachment.MessageId?.ToString("D"));
    }
}