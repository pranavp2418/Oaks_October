using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using JMCRM_AI.Data;
using JMCRM_AI.Models;
using JMCRM_AI.Services;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

var json = new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase, PropertyNameCaseInsensitive = true };
json.Converters.Add(new JsonStringEnumConverter());
try
{
    var input = await Console.In.ReadToEndAsync();
    if (input.Length > 1_000_000) throw new DemoError(413, "Workspace is too large.");
    var request = JsonSerializer.Deserialize<WorkspaceRequest>(input, json) ?? throw new DemoError(400, "JSON request required.");
    var engine = new WorkspaceEngine();
    var result = await engine.Run(request, json);
    Console.Write(JsonSerializer.Serialize(new { ok = true, data = result }, json));
}
catch (Exception e)
{
    var code = e is DemoError d ? d.Status : e is JsonException ? 400 : 500;
    if (code == 500) Console.Error.WriteLine(e);
    Console.Write(JsonSerializer.Serialize(new { ok = false, status = code, error = code == 500 ? "The workspace could not be evaluated." : e.Message }, json));
}

sealed class DemoError(int status, string message) : Exception(message) { public int Status { get; } = status; }
sealed record Command(string Key, string Type, JsonElement Payload);
sealed record WorkspaceRequest(List<Command>? Events, Command? Command, int? ExpectedRevision);

sealed class WorkspaceEngine
{
    readonly DateOnly today = new(2026, 10, 8);
    readonly DateTime origin = new(2026, 10, 8, 12, 0, 0, DateTimeKind.Utc);
    readonly OpportunityScoringService scoring = new();
    readonly TemplateOutreachMessageService messages = new();
    readonly List<object> audit = [];
    string chain = new('0', 64);
    int sequence;

    public async Task<object> Run(WorkspaceRequest request, JsonSerializerOptions json)
    {
        var events = request.Events ?? [];
        if (events.Count > 500) throw new DemoError(413, "Export this workspace and start a new one after 500 operations.");
        using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        await using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlite(connection).Options);
        await db.Database.EnsureCreatedAsync();
        await Seed(db);
        await Generate(db);
        var seen = new Dictionary<string, string>(StringComparer.Ordinal);
        foreach (var cmd in events)
        {
            ValidateCommand(cmd);
            var fingerprint = JsonSerializer.Serialize(new { cmd.Type, cmd.Payload }, json);
            if (!seen.TryAdd(cmd.Key, fingerprint)) throw new DemoError(400, "Journal contains duplicate operation keys.");
            await Apply(db, cmd);
            Record(cmd, json);
        }
        object? result = null;
        var replayed = false;
        if (request.Command is { } command)
        {
            ValidateCommand(command);
            var fingerprint = JsonSerializer.Serialize(new { command.Type, command.Payload }, json);
            if (seen.TryGetValue(command.Key, out var previous))
            {
                if (previous != fingerprint) throw new DemoError(409, "Operation key was reused with different content.");
                replayed = true;
            }
            else
            {
                if (request.ExpectedRevision != events.Count) throw new DemoError(409, "Workspace revision changed. Reload the current workspace and retry.");
                if (events.Count == 500) throw new DemoError(413, "Workspace operation limit reached.");
                await using var transaction = await db.Database.BeginTransactionAsync();
                result = await Apply(db, command);
                await transaction.CommitAsync();
                events.Add(command);
                Record(command, json);
            }
        }
        var rows = await db.SalesOpportunities.AsNoTracking().Include(x => x.Customer).Include(x => x.Product).Include(x => x.Activities).ToListAsync();
        var customers = await db.Customers.AsNoTracking().Include(x => x.Purchases).ThenInclude(x => x.Product).Include(x => x.WishlistItems).ToListAsync();
        var products = await db.Products.AsNoTracking().ToListAsync();
        return new {
            events, revision = events.Count, replayed, result, audit, auditHead = chain, asOf = today.ToString("yyyy-MM-dd"), seed = 8102026,
            opportunities = rows.OrderByDescending(x => x.Score).ThenBy(x => x.Id).Select(x => new { x.Id, x.CustomerId, customer = x.Customer.FullName, tier = x.Customer.CustomerTier, x.ProductId, product = x.Product.Name, x.Product.Sku, x.Product.QuantityAvailable, type = x.OpportunityType, x.Score, x.Status, x.Explanation, x.RecommendedAction, x.MessageDraft, x.EstimatedRevenue, allowed = Allowed(x.Status), activities = x.Activities.OrderBy(a => a.Id).Select(a => new { a.ActivityType, a.Notes, a.CreatedAt }) }),
            customers = customers.Select(x => new { x.Id, x.FullName, x.Email, x.Phone, x.CustomerTier, x.LifetimeValue, x.PreferredCategory, x.PreferredMetal, x.PreferredStoneShape, x.LastPurchaseDate, x.LastContactDate, x.Birthday, x.Anniversary, purchases = x.Purchases.Select(p => new { p.PurchaseDate, product = p.Product.Name, p.SaleAmount }), wishlist = x.WishlistItems.Select(w => new { w.ProductCategory, w.PreferredMetal, w.TargetBudget }) }),
            products = products.Select(p => new { p.Id, p.Sku, p.Name, p.Price, p.QuantityAvailable, p.Metal, p.StoneShape, p.Category, p.IsNewArrival }),
            metrics = new { customers = customers.Count, opportunities = rows.Count, active = rows.Count(x => x.Status is not (OpportunityStatus.Won or OpportunityStatus.Dismissed)), contacted = rows.Count(x => x.Status == OpportunityStatus.Contacted), won = rows.Count(x => x.Status == OpportunityStatus.Won), potentialRevenue = rows.Where(x => x.Status is not (OpportunityStatus.Won or OpportunityStatus.Dismissed)).Sum(x => x.EstimatedRevenue), categories = Enum.GetValues<OpportunityType>().Select(t => new { type = t, count = rows.Count(x => x.OpportunityType == t) }) }
        };
    }

    void ValidateCommand(Command command)
    {
        if (command is null || command.Type is null) throw new DemoError(400, "Operation object and type required.");
        if (string.IsNullOrWhiteSpace(command.Key) || command.Key.Length > 80 || command.Key.Any(c => !char.IsAsciiLetterOrDigit(c) && c is not '-' and not '_')) throw new DemoError(400, "Operation key must contain 1–80 letters, numbers, underscores or hyphens.");
        if (command.Payload.ValueKind != JsonValueKind.Object) throw new DemoError(400, "Operation payload must be an object.");
    }
    static int Number(JsonElement p, string name)
    { if (!p.TryGetProperty(name, out var v) || !v.TryGetInt32(out var n)) throw new DemoError(400, $"{name} must be an integer."); return n; }
    static string Text(JsonElement p, string name)
    { if (!p.TryGetProperty(name, out var v) || v.ValueKind != JsonValueKind.String) throw new DemoError(400, $"{name} must be text."); return v.GetString()!.Trim(); }
    DateTime Now => origin.AddSeconds(sequence);
    void Record(Command cmd, JsonSerializerOptions json)
    {
        sequence++;
        chain = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(chain + JsonSerializer.Serialize(cmd, json)))).ToLowerInvariant();
        audit.Add(new { revision = sequence, cmd.Key, cmd.Type, time = Now, hash = chain });
    }
    static OpportunityStatus[] Allowed(OpportunityStatus s) => s switch {
        OpportunityStatus.New => [OpportunityStatus.Contacted, OpportunityStatus.Dismissed],
        OpportunityStatus.Contacted => [OpportunityStatus.Replied, OpportunityStatus.Dismissed],
        OpportunityStatus.Replied => [OpportunityStatus.AppointmentBooked, OpportunityStatus.Dismissed],
        OpportunityStatus.AppointmentBooked => [OpportunityStatus.Won, OpportunityStatus.Dismissed],
        OpportunityStatus.Dismissed => [OpportunityStatus.New], _ => [] };

    async Task<object> Apply(AppDbContext db, Command cmd)
    {
        var p = cmd.Payload;
        if (cmd.Type == "generate") return new { created = await Generate(db) };
        if (cmd.Type == "stock")
        {
            var product = await db.Products.FindAsync(Number(p, "id")) ?? throw new DemoError(404, "Product not found.");
            var quantity = Number(p, "quantity"); if (quantity is < 0 or > 9999) throw new DemoError(400, "Stock must be between 0 and 9999.");
            product.QuantityAvailable = quantity; await db.SaveChangesAsync(); return new { quantity };
        }
        var row = await db.SalesOpportunities.Include(x => x.Customer).Include(x => x.Product).Include(x => x.Activities).FirstOrDefaultAsync(x => x.Id == Number(p, "id")) ?? throw new DemoError(404, "Opportunity not found.");
        string note; ActivityType activity;
        switch (cmd.Type)
        {
            case "draft":
                var text = Text(p, "text"); if (text.Length is < 1 or > 1200) throw new DemoError(400, "Draft must contain 1–1200 characters.");
                row.MessageDraft = text; note = "Draft edited and saved for human review."; activity = ActivityType.MessageRegenerated; break;
            case "regenerate":
                row.MessageDraft = messages.Generate(row.Customer, row.Product, row.OpportunityType); note = "Template draft regenerated; no message was sent."; activity = ActivityType.MessageRegenerated; break;
            case "status":
                var name = Text(p, "status");
                if (!Enum.TryParse<OpportunityStatus>(name, false, out var next) || !Enum.IsDefined(next)) throw new DemoError(400, "Unknown workflow status.");
                if (!Allowed(row.Status).Contains(next)) throw new DemoError(409, $"Cannot move {row.Status} directly to {next}.");
                if (next == OpportunityStatus.Won && row.Product.QuantityAvailable == 0) throw new DemoError(409, "Product is out of stock. Review inventory before recording a sale.");
                note = $"Workflow changed from {row.Status} to {next}; synthetic demo activity only.";
                row.Status = next; if (next == OpportunityStatus.Contacted) row.Customer.LastContactDate = today;
                if (next == OpportunityStatus.Won) row.Product.QuantityAvailable--;
                activity = next switch { OpportunityStatus.Contacted => ActivityType.Contacted, OpportunityStatus.Replied => ActivityType.CustomerReplied, OpportunityStatus.AppointmentBooked => ActivityType.AppointmentBooked, OpportunityStatus.Won => ActivityType.SaleWon, OpportunityStatus.Dismissed => ActivityType.Dismissed, _ => ActivityType.Generated }; break;
            default: throw new DemoError(400, "Unknown operation type.");
        }
        row.UpdatedAt = Now; row.Activities.Add(new OutreachActivity { ActivityType = activity, Notes = note, CreatedAt = Now });
        await db.SaveChangesAsync(); return new { id = row.Id, row.Status };
    }

    async Task<int> Generate(AppDbContext db)
    {
        var customers = await db.Customers.Include(x => x.Purchases).ThenInclude(x => x.Product).Include(x => x.WishlistItems).OrderBy(x => x.Id).ToListAsync();
        var products = await db.Products.Where(x => x.QuantityAvailable > 0).OrderBy(x => x.Id).ToListAsync();
        var existing = await db.SalesOpportunities.ToListAsync(); var created = 0;
        foreach (var customer in customers)
        foreach (var type in Enum.GetValues<OpportunityType>())
        {
            var eligible = type switch {
                OpportunityType.UpcomingAnniversary => OpportunityScoringService.DaysUntil(customer.Anniversary, today) <= 30,
                OpportunityType.UpcomingBirthday => OpportunityScoringService.DaysUntil(customer.Birthday, today) <= 30,
                OpportunityType.InactiveVipCustomer => customer.CustomerTier == CustomerTier.VIP && customer.LastPurchaseDate is { } last && today.DayNumber - last.DayNumber >= 240,
                OpportunityType.WishlistInventoryMatch => customer.WishlistItems.Count > 0,
                OpportunityType.PreviousPurchaseCrossSell => customer.Purchases.Count > 0,
                _ => true };
            if (!eligible) continue;
            var candidates = type == OpportunityType.NewArrivalMatch ? products.Where(p => p.IsNewArrival) : products.AsEnumerable();
            if (type == OpportunityType.WishlistInventoryMatch) candidates = candidates.Where(p => customer.WishlistItems.Any(w => w.ProductCategory == p.Category && (w.PreferredMetal == "" || w.PreferredMetal == p.Metal)));
            if (type == OpportunityType.PreviousPurchaseCrossSell) candidates = candidates.Where(p => !customer.Purchases.Any(x => x.ProductId == p.Id));
            var product = candidates.OrderByDescending(p => scoring.Score(customer,p,type,today).Score).ThenBy(p => p.Id).FirstOrDefault();
            if (product == null || existing.Any(x => x.CustomerId == customer.Id && x.ProductId == product.Id && x.OpportunityType == type)) continue;
            var score = scoring.Score(customer,product,type,today);
            var opportunity = new SalesOpportunity { CustomerId = customer.Id, ProductId = product.Id, OpportunityType = type, Status = OpportunityStatus.New, Score = score.Score, Explanation = score.Explanation, RecommendedAction = score.RecommendedAction, MessageDraft = messages.Generate(customer,product,type), EstimatedRevenue = product.Price, CreatedAt = Now, UpdatedAt = Now };
            opportunity.Activities.Add(new OutreachActivity { ActivityType = ActivityType.Generated, Notes = "Deterministic recommendation generated from synthetic data.", CreatedAt = Now });
            db.SalesOpportunities.Add(opportunity); existing.Add(opportunity); created++;
        }
        await db.SaveChangesAsync(); return created;
    }

    async Task Seed(AppDbContext db)
    {
        var categories = new[] { "Earrings", "Rings", "Necklaces", "Bracelets", "Chains", "Wedding Bands" };
        for (var i = 0; i < 12; i++) db.Products.Add(new Product { Id = i+1, Sku = $"DEMO-{i+1:000}", Name = $"{(i%2==0?"Solstice":"Harbor")} {categories[i%6]}", Category = categories[i%6], Metal = i%2==0?"White Gold":"Yellow Gold", StoneShape = i%2==0?"Oval":"Round", Price = 1200 + i*350, QuantityAvailable = i==11?0:2+i%5, IsNewArrival = i<6 });
        for (var i = 0; i < 18; i++)
        {
            var c = new Customer { Id=i+1, FirstName=$"Demo {i+1:00}", LastName="Customer", Email=$"customer{i+1:00}@example.test", Phone=$"555-010-{i+1:04}", CustomerTier=(CustomerTier)(i%3), LifetimeValue=2400+i*1700, PreferredCategory=categories[i%6], PreferredMetal=i%2==0?"White Gold":"Yellow Gold", PreferredStoneShape=i%2==0?"Oval":"Round", Birthday=today.AddDays(i%4==0?7:90), Anniversary=today.AddDays(i%5==0?12:120), LastPurchaseDate=today.AddDays(i%3==2?-300:-60), Notes="Reproducible fictional demonstration. Seed 8102026." };
            if(i%3!=0) c.Purchases.Add(new Purchase { ProductId=i%11+1, PurchaseDate=today.AddDays(-100-i*10), SaleAmount=1200+i*350, Description="Synthetic historical purchase" });
            if(i%2==0) c.WishlistItems.Add(new WishlistItem { ProductCategory=categories[i%6], PreferredMetal=c.PreferredMetal, TargetBudget=1800+i*120, CreatedAt=origin });
            db.Customers.Add(c);
        }
        await db.SaveChangesAsync();
    }
}
