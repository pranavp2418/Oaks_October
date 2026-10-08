using JMCRM_AI.Data;
using JMCRM_AI.Models;
using Microsoft.EntityFrameworkCore;

namespace JMCRM_AI.Services;

public sealed record ScoreResult(int Score, string Explanation, string RecommendedAction);

public interface IOpportunityScoringService
{
    ScoreResult Score(Customer customer, Product product, OpportunityType type, DateOnly today);
}

public sealed class OpportunityScoringService : IOpportunityScoringService
{
    public ScoreResult Score(Customer customer, Product product, OpportunityType type, DateOnly today)
    {
        var score = type switch
        {
            OpportunityType.UpcomingAnniversary or OpportunityType.UpcomingBirthday => 25,
            OpportunityType.InactiveVipCustomer => 20,
            OpportunityType.WishlistInventoryMatch => 25,
            OpportunityType.PreviousPurchaseCrossSell => 18,
            OpportunityType.NewArrivalMatch => 18,
            _ => 10
        };
        var reasons = new List<string>();

        if (type is OpportunityType.UpcomingAnniversary or OpportunityType.UpcomingBirthday)
        {
            var occasion = type == OpportunityType.UpcomingAnniversary ? "anniversary" : "birthday";
            var date = type == OpportunityType.UpcomingAnniversary ? customer.Anniversary : customer.Birthday;
            var days = DaysUntil(date, today);
            score += days <= 14 ? 20 : 12;
            reasons.Add($"{occasion} in {days} day{(days == 1 ? "" : "s")}");
        }

        if (customer.CustomerTier == CustomerTier.VIP) { score += 15; reasons.Add("VIP relationship"); }
        else if (customer.CustomerTier == CustomerTier.Preferred) score += 8;
        if (customer.LifetimeValue >= 25000) { score += 10; reasons.Add("high lifetime value"); }
        else if (customer.LifetimeValue >= 10000) score += 6;

        if (customer.LastPurchaseDate is { } lastPurchase)
        {
            var inactiveDays = today.DayNumber - lastPurchase.DayNumber;
            if (inactiveDays >= 270) { score += 10; reasons.Add($"{inactiveDays / 30} months since last purchase"); }
            else if (inactiveDays >= 120) score += 5;
        }

        var wishlist = customer.WishlistItems.Any(w =>
            Equal(w.ProductCategory, product.Category) &&
            (string.IsNullOrWhiteSpace(w.PreferredMetal) || Equal(w.PreferredMetal, product.Metal)));
        if (wishlist) { score += 18; reasons.Add("direct wishlist match"); }
        if (Equal(customer.PreferredMetal, product.Metal)) { score += 6; reasons.Add($"preferred {product.Metal.ToLowerInvariant()} metal"); }
        if (!string.IsNullOrWhiteSpace(product.StoneShape) && Equal(customer.PreferredStoneShape, product.StoneShape)) { score += 6; reasons.Add($"preferred {product.StoneShape.ToLowerInvariant()} shape"); }
        if (Equal(customer.PreferredCategory, product.Category)) { score += 5; reasons.Add("preferred category"); }
        if (product.QuantityAvailable > 0) { score += 5; reasons.Add("in stock now"); }
        if (product.IsNewArrival) { score += 5; reasons.Add("new arrival"); }

        score = Math.Clamp(score, 0, 100);
        var intro = customer.CustomerTier == CustomerTier.VIP ? "High-value VIP customer" : $"{customer.CustomerTier} customer";
        var explanation = $"{intro} with {string.Join(", ", reasons)}. {product.Name} is a strong, currently available recommendation.";
        var action = type switch
        {
            OpportunityType.UpcomingAnniversary => "Offer a private anniversary gift consultation",
            OpportunityType.UpcomingBirthday => "Share a personalized birthday selection",
            OpportunityType.InactiveVipCustomer => "Reconnect with a personal inventory preview",
            OpportunityType.WishlistInventoryMatch => "Notify the customer that their wishlist match is available",
            OpportunityType.PreviousPurchaseCrossSell => "Recommend a complementary piece and private fitting",
            _ => "Introduce this new arrival and offer to reserve it"
        };
        return new(score, explanation, action);
    }

    public static int DaysUntil(DateOnly? value, DateOnly today)
    {
        if (value is null) return 999;
        var next = new DateOnly(today.Year, value.Value.Month, Math.Min(value.Value.Day, DateTime.DaysInMonth(today.Year, value.Value.Month)));
        if (next < today) next = next.AddYears(1);
        return next.DayNumber - today.DayNumber;
    }

    private static bool Equal(string a, string b) => string.Equals(a, b, StringComparison.OrdinalIgnoreCase);
}

public interface IOutreachMessageService
{
    string Generate(Customer customer, Product product, OpportunityType type);
}

public sealed class TemplateOutreachMessageService : IOutreachMessageService
{
    public string Generate(Customer customer, Product product, OpportunityType type)
    {
        var reason = type switch
        {
            OpportunityType.UpcomingAnniversary => "your anniversary is coming up",
            OpportunityType.UpcomingBirthday => "your birthday is coming up",
            OpportunityType.InactiveVipCustomer => "I wanted to personally share something new with you",
            OpportunityType.WishlistInventoryMatch => "a piece matching your wishlist has arrived",
            OpportunityType.PreviousPurchaseCrossSell => "we found a piece that would beautifully complement your earlier purchase",
            _ => "a new arrival reminded me of your style"
        };
        return $"Hi {customer.FirstName}, {reason}. The {product.Name} is available now and I thought it would be an excellent fit for your collection. I would be happy to reserve it or arrange a private viewing for you—would you like to stop in this week?";
    }
}

