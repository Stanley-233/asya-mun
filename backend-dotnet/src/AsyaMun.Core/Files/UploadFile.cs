namespace AsyaMun.Core.Files;

/// <summary>The caller owns the content stream and keeps it open for the upload.</summary>
public sealed record UploadFile(string FileName, long Length, Stream Content);
