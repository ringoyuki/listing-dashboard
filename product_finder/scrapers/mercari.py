from .base import BaseScraper
from utils.text_matcher import TextMatcher
import time

class MercariScraper(BaseScraper):
    async def search(self, keyword: str) -> bool:
        page = await self.get_page()
        found_any = False
        try:
            # Human-like behavior: Go to home, find search bar, input text
            print(f"[Mercari] Accessing homepage...")
            await self.safe_goto(page, "https://jp.mercari.com/")
            
            search_input_selector = "input[type='search']" # Common selector for search bar
            
            try:
                # Wait for search bar
                await page.wait_for_selector(search_input_selector, timeout=10000)
                await self.browser_manager.mimic_human_behavior(page) # Small scroll/wait
                
                print(f"[Mercari] Entering keyword: {keyword}")
                await page.fill(search_input_selector, keyword)
                await self.browser_manager.random_sleep(0.5, 1.5)
                await page.press(search_input_selector, "Enter")
                
                # Wait for navigation/results
                await page.wait_for_load_state("domcontentloaded")
                await self.browser_manager.random_sleep(2, 4)
                
            except Exception as e:
                print(f"[Mercari] Search interaction failed ({e}), falling back to direct URL.")
                # URL encoding for safety
                import urllib.parse
                safe_keyword = urllib.parse.quote(keyword)
                url = f"https://jp.mercari.com/search?keyword={safe_keyword}"
                await self.safe_goto(page, url)

            # Check for no results (Selector might need adjustment based on actual page)
            # Mercari often shows "検索結果 0件" or similar text
            content = await page.content()
            if "検索結果 0件" in content or "該当する商品は見つかりませんでした" in content:
                print("[Mercari] No results found.")
                return False

            # Wait for items to load
            try:
                # data-testid="item-cell" is a strong candidate for Mercari
                await page.wait_for_selector("li[data-testid='item-cell']", timeout=10000)
            except:
                print("[Mercari] No items loaded or timed out.")
                return False

            items = await page.query_selector_all("li[data-testid='item-cell']")
            
            # Process top 5 items
            for item in items[:5]:
                try:
                    # Extract Data
                    link_elem = await item.query_selector("a")
                    if not link_elem: continue
                    
                    item_url = await link_elem.get_attribute("href")
                    if item_url and not item_url.startswith("http"):
                        item_url = "https://jp.mercari.com" + item_url

                    # Title often in image alt or aria-label, but let's try to find text
                    # The structure varies, but usually:
                    # div[class*='ItemThumbnail__Thumbnail'] img[alt='title']
                    img_elem = await item.query_selector("img")
                    title = await img_elem.get_attribute("alt") if img_elem else "No Title"
                    
                    price_elem = await item.query_selector("span[class*='number']") # This is weak, classes change
                    # Better specific selector for price if available:
                    # [data-testid="price"] -> span[class*='number']
                    if not price_elem:
                        # Fallback try generic price look
                        price_text = "N/A"
                    else:
                        price_text = await price_elem.text_content()

                    image_src = await img_elem.get_attribute("src") if img_elem else None

                    # --- Verification Logic ---
                    rank = "C" # Default: No Match
                    
                    # 1. Management Number Match (Partial Match Allowed as per user request)
                    # We check if management_number is in title OR description (description check requires visiting item page, skipping for speed unless critical)
                    if TextMatcher.contains_management_number(title, self.management_number):
                        rank = "A"

                    # 2. Image Similarity (Upgrade to S if A, or set to S if image matches)
                    if self.base_image and image_src:
                        # We need to download and compare
                        is_similar = False
                        try:
                            # Only compare image if we have some reason to believe it might be it, OR if we are doing a broad search
                            downloaded_img = await self.image_matcher.download_image(image_src)
                            if downloaded_img:
                                is_similar = self.image_matcher.compare_images(self.base_image, downloaded_img)
                        except Exception as e:
                            print(f"[Mercari] Image comparison failed: {e}")
                        
                        if is_similar:
                            rank = "S" if rank == "A" else "B" # Image matched
                    
                    # 3. Fuzzy Title Match (if currently C) - keyword search inherently does this to some extent.
                    # If we searched by Title, likely the title matches keyword.
                    # If we searched by ID, likely the ID matches.
                    
                    # IMPORTANT: If we found ANY matching item with rank A or S or B, we consider this "Found"
                    if rank in ["S", "A", "B"]:
                        self.add_result("Mercari", title, price_text, item_url, rank, image_src)
                        found_any = True
                    # If searched by strict title, maybe we assume C rank items are still "Found" candidates?
                    # Let's say we only count as "Found" if we scrape it successfully. 
                    # But for "Title Search" logic, maybe we want to know if *specific* item was found.
                    # For now, let's return True if any items were scraped, but maybe loose criteria.
                    if rank == "C" and keyword != self.management_number:
                         # If we searched by title, checking specifically for management number might be too strict
                         # If searched by Title, and item title resembles strict keyword?
                         pass
                    
                    # Store even C rank if we are desperate? No, let's keep clean.
                    # User wants to find THE item.
                    
                    # Revised Strategy: If searching by Title, we might not get "A" (ID Match) immediately.
                    # But if we search by Title1, and get results, we assume we found potential candidates.
                    found_any = True # If we got results, return True to stop falling back?
                    # Wait, if we return True, we stop searching next keywords.
                    # If I search "Adidas Shoes" and get 1000 unrelated shoes, I shouldn't stop if I'm looking for "Adidas Shoes A123".
                    # But the user logic is "Title1 -> Title2 -> ID".
                    # If Title1 finds 0 items, go to Title2.
                    # So if Mercari returns items for Title1, we consider it "Found" on Mercari?
                    # Or do we need to check if they match the desired item?
                    # The prompt implies: "If Title search finds nothing (0 results), use ID".
                    # So 'Found' means 'Search returned > 0 results'.
                    
                except Exception as e:
                    print(f"[Mercari] Error parsing item: {e}")
                    continue
            
            return found_any

        except Exception as e:
            print(f"[Mercari] Scraper failed: {e}")
            return False
        finally:
            await page.close()
