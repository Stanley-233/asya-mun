namespace AsyaMun.Api.Models;

public class UserGroup
{
    public long Id { get; set; }

    public string GroupName { get; set; } = null!;

    public virtual ICollection<User> UserUus { get; set; } = new List<User>();
}