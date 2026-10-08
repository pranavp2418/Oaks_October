using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace JMCRM_AI.Models;

public enum CustomerTier { Standard, Preferred, VIP }
public enum OpportunityType { UpcomingAnniversary, UpcomingBirthday, InactiveVipCustomer, WishlistInventoryMatch, PreviousPurchaseCrossSell, NewArrivalMatch }
public enum OpportunityStatus { New, Contacted, Replied, AppointmentBooked, Won, Dismissed }
public enum ActivityType { Generated, MessageRegenerated, Contacted, CustomerReplied, AppointmentBooked, SaleWon, Dismissed }

public sealed class Customer
{
    public int Id { get; set; }
    [Required, MaxLength(60)] public string FirstName { get; set; } = "";
    [Required, MaxLength(60)] public string LastName { get; set; } = "";
    [Required, EmailAddress, MaxLength(120)] public string Email { get; set; } = "";
    [Required, Phone, MaxLength(30)] public string Phone { get; set; } = "";
    public DateOnly? Birthday { get; set; }
    public DateOnly? Anniversary { get; set; }
    [MaxLength(40)] public string PreferredMetal { get; set; } = "";
    [MaxLength(40)] public string PreferredStoneShape { get; set; } = "";
    [MaxLength(60)] public string PreferredCategory { get; set; } = "";
    [Column(TypeName = "decimal(12,2)")] public decimal LifetimeValue { get; set; }
    public DateOnly? LastPurchaseDate { get; set; }
    public DateOnly? LastContactDate { get; set; }
    public CustomerTier CustomerTier { get; set; }
    [MaxLength(500)] public string Notes { get; set; } = "";
    public List<Purchase> Purchases { get; set; } = [];
    public List<WishlistItem> WishlistItems { get; set; } = [];
    public List<SalesOpportunity> Opportunities { get; set; } = [];
    [NotMapped] public string FullName => $"{FirstName} {LastName}";
}

public sealed class Product
{
    public int Id { get; set; }
    [Required, MaxLength(30)] public string Sku { get; set; } = "";
    [Required, MaxLength(120)] public string Name { get; set; } = "";
    [Required, MaxLength(60)] public string Category { get; set; } = "";
    [Required, MaxLength(40)] public string Metal { get; set; } = "";
    [MaxLength(40)] public string StoneShape { get; set; } = "";
    [Column(TypeName = "decimal(12,2)")] public decimal Price { get; set; }
    [Range(0, 9999)] public int QuantityAvailable { get; set; }
    [MaxLength(20)] public string ImagePlaceholder { get; set; } = "GEM";
    public bool IsNewArrival { get; set; }
    public List<Purchase> Purchases { get; set; } = [];
    public List<SalesOpportunity> Opportunities { get; set; } = [];
}

public sealed class Purchase
{
    public int Id { get; set; }
    public int CustomerId { get; set; }
    public Customer Customer { get; set; } = null!;
    public int ProductId { get; set; }
    public Product Product { get; set; } = null!;
    public DateOnly PurchaseDate { get; set; }
    [Column(TypeName = "decimal(12,2)")] public decimal SaleAmount { get; set; }
    [Required, MaxLength(180)] public string Description { get; set; } = "";
}

public sealed class WishlistItem
{
    public int Id { get; set; }
    public int CustomerId { get; set; }
    public Customer Customer { get; set; } = null!;
    [Required, MaxLength(60)] public string ProductCategory { get; set; } = "";
    [MaxLength(40)] public string PreferredMetal { get; set; } = "";
    [MaxLength(40)] public string PreferredStoneShape { get; set; } = "";
    [Column(TypeName = "decimal(12,2)")] public decimal TargetBudget { get; set; }
    public DateTime CreatedAt { get; set; }
}

public sealed class SalesOpportunity
{
    public int Id { get; set; }
    public int CustomerId { get; set; }
    public Customer Customer { get; set; } = null!;
    public int ProductId { get; set; }
    public Product Product { get; set; } = null!;
    public OpportunityType OpportunityType { get; set; }
    [Range(0, 100)] public int Score { get; set; }
    [Required, MaxLength(1000)] public string Explanation { get; set; } = "";
    [Required, MaxLength(240)] public string RecommendedAction { get; set; } = "";
    [Required, MaxLength(1200)] public string MessageDraft { get; set; } = "";
    [Column(TypeName = "decimal(12,2)")] public decimal EstimatedRevenue { get; set; }
    public OpportunityStatus Status { get; set; } = OpportunityStatus.New;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public List<OutreachActivity> Activities { get; set; } = [];
}

public sealed class OutreachActivity
{
    public int Id { get; set; }
    public int SalesOpportunityId { get; set; }
    public SalesOpportunity SalesOpportunity { get; set; } = null!;
    public ActivityType ActivityType { get; set; }
    [Required, MaxLength(500)] public string Notes { get; set; } = "";
    public DateTime CreatedAt { get; set; }
}

public sealed class ErrorViewModel
{
    public string? RequestId { get; set; }
    public bool ShowRequestId => !string.IsNullOrEmpty(RequestId);
}

