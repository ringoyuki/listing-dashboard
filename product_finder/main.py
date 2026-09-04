import asyncio
import argparse
import pandas as pd
import os
from utils.browser import BrowserManager
from scrapers.mercari import MercariScraper
from scrapers.rakuma import RakumaScraper
from scrapers.yahoo import YahooFleaScraper, YahooAuctionsScraper

async def main():
    parser = argparse.ArgumentParser(description="Cross-platform Product Finder")
    # Management number is required for validation (checking if found item matches)
    parser.add_argument("management_number", help="Management number (used for validation)")
    parser.add_argument("--keywords", nargs="+", help="List of keywords to search in order (e.g. Title1 Title2 MgmtNum). If not provided, uses management_number.", default=[])
    parser.add_argument("--image-path", help="Path to reference image for comparison")
    parser.add_argument("--visible", action="store_true", help="Run browser in visible mode")
    
    args = parser.parse_args()
    
    management_number = args.management_number
    search_keywords = args.keywords
    
    # If no keywords provided, default to searching by management number only
    if not search_keywords:
        search_keywords = [management_number]

    image_path = args.image_path
    headless = not args.visible

    print(f"Target Management Number (for validation): {management_number}")
    print(f"Search Keywords (in order): {search_keywords}")

    all_results = []
    
    async with BrowserManager(headless=headless) as browser_manager:
        # Initialize scrapers
        # We pass management_number to scrapers so they can verify items
        scrapers = [
            MercariScraper(browser_manager, management_number, image_path),
            RakumaScraper(browser_manager, management_number, image_path),
            YahooFleaScraper(browser_manager, management_number, image_path),
            YahooAuctionsScraper(browser_manager, management_number, image_path)
        ]

        # Sequential Search Logic:
        # For each keyword in priority list:
        #   Run all scrapers with that keyword.
        #   If ANY items are found across all sites, stop processing further keywords (or maybe stop per-site?)
        #   User request: "Search Title 1 -> Title 2 -> Mgmt Num". 
        #   Implies: Try Title 1. If found, Good. As backup, try Title 2...
        
        # We will iterate through keywords.
        # However, we don't want to re-scrape a site if it already found something?
        # Or do we want to search ALL sites with Keyword 1 first? Yes.
        
        # Strategy:
        # 1. Search all sites with Keyword 1.
        # 2. Collect results.
        # 3. If we have results (maybe specific Rank?), we might stop.
        #    But different sites might have different inventory.
        #    The "Fallback" logic usually implies "If I didn't find it with Title 1, try Title 2".
        #    If I found it on Mercari with Title 1, do I still search Rakuma with Title 1? Yes.
        #    If I found it on Mercari with Title 1, do I search Mercari with Title 2? Probably no need.
        
        # Refined Strategy:
        # Loop through sites.
        # For each site:
        #   Loop through keywords.
        #   Search(site, keyword)
        #   If found items -> Break keyword loop (move to next site)
        #   Else -> Continue to next keyword
        
        # Helper function to run a single scraper through keywords
        async def run_scraper_sequence(scraper, keywords):
            site_name = scraper.__class__.__name__.replace("Scraper", "")
            print(f"[{site_name}] Starting search sequence...")
            
            for keyword in keywords:
                # print(f"[{site_name}] Trying keyword: {keyword}") # Reduce log noise?
                try:
                    found = await scraper.search(keyword)
                    if found:
                        print(f"[{site_name}] Items FOUND with '{keyword}'. Stopping fallback.")
                        return # Stop trying other keywords for this site
                    else:
                        # print(f"[{site_name}] No items with '{keyword}'.")
                        # Small delay between keywords on same site is still good practice, but reduce it
                        if keyword != keywords[-1]:
                            await asyncio.sleep(1) 
                except Exception as e:
                    print(f"[{site_name}] Error searching '{keyword}': {e}")
            
            print(f"[{site_name}] Search sequence finished.")

        # Run all scrapers in parallel
        tasks = [run_scraper_sequence(scraper, search_keywords) for scraper in scrapers]
        await asyncio.gather(*tasks)

        # Collect results
        for scraper in scrapers:
            all_results.extend(scraper.results)


if __name__ == "__main__":
    asyncio.run(main())
