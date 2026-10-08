using JMCRM_AI.Models;
using Microsoft.EntityFrameworkCore;

namespace JMCRM_AI.Data;

public sealed class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Customer> Customers => Set<Customer>();
    public DbSet<Product> Products => Set<Product>();
    public DbSet<Purchase> Purchases => Set<Purchase>();
    public DbSet<WishlistItem> WishlistItems => Set<WishlistItem>();
    public DbSet<SalesOpportunity> SalesOpportunities => Set<SalesOpportunity>();
    public DbSet<OutreachActivity> OutreachActivities => Set<OutreachActivity>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Product>().HasIndex(x => x.Sku).IsUnique();
        modelBuilder.Entity<SalesOpportunity>().HasIndex(x => new { x.CustomerId, x.ProductId, x.OpportunityType }).IsUnique();
        modelBuilder.Entity<Purchase>().HasOne(x => x.Product).WithMany(x => x.Purchases).HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<SalesOpportunity>().HasOne(x => x.Product).WithMany(x => x.Opportunities).HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Restrict);
    }
}

