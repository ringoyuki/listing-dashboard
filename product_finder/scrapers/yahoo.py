from .base import BaseScraper
from utils.text_matcher import TextMatcher

class YahooFleaScraper(BaseScraper):
    async def search(self, keyword: str) -> bool:
        page = await self.get_page()
        found_any = False
        try:
            print(f"[YahooFlea] Accessing homepage...")
            await self.safe_goto(page, "https://paypayfleamarket.yahoo.co.jp/")
            
            search_input_selector = "input[type='search']"
            
            try:
                # Wait for search bar
                await page.wait_for_selector(search_input_selector, timeout=10000)
                await self.browser_manager.mimic_human_behavior(page)
                
                print(f"[YahooFlea] Entering keyword: {keyword}")
                await page.fill(search_input_selector, keyword)
                await self.browser_manager.random_sleep(0.5, 1.5)
                await page.press(search_input_selector, "Enter")
                
                # Wait for results
                await page.wait_for_load_state("domcontentloaded")
                await self.browser_manager.random_sleep(2, 4)
            except Exception as e:
                print(f"[YahooFlea] Search interaction failed ({e}), falling back to direct URL.")
                import urllib.parse
                safe_keyword = urllib.parse.quote(keyword)
                # Note: Yahoo Flea Market URL structure might change, but typically /search/KEYWORD
                url = f"https://paypayfleamarket.yahoo.co.jp/search/{safe_keyword}"
                await self.safe_goto(page, url)

            # Check for no results
            # Yahoo Flea Market often shows "検索結果 0件" or "条件に一致する商品が見つかりませんでした"
            content = await page.content()
            if "条件に一致する商品が見つかりませんでした" in content:
                print("[YahooFlea] No items found.")
                return False

            item_selector = "a[class*='ItemThumbnail']" # Weak selector, classes are obfuscated
            # Better to find anchor tags that look like item links in a grid.
            # IDK exact react classes. Let's try generic approach if specific fails.
            
            try:
                # wait for at least one item
                await page.wait_for_selector("img[alt]", timeout=5000) 
            except:
                print("[YahooFlea] No items found or timeout.")
                return False

            items = await page.query_selector_all("a[href*='/item/']") # Items usually have /item/ in URL
            if not items:
                print("[YahooFlea] No item links found.")
                return False

            for item in items[:5]:
                try:
                    item_url = await item.get_attribute("href")
                    if not item_url.startswith("http"):
                        item_url = "https://paypayfleamarket.yahoo.co.jp" + item_url
                    
                    img_elem = await item.query_selector("img")
                    if img_elem:
                        title = await img_elem.get_attribute("alt")
                        image_src = await img_elem.get_attribute("src")
                    else:
                        title = "No Title"
                        image_src = None
                    
                    # Price often separate, difficult to link without container. 
                    # Assuming anchor wraps everything:
                    # Look for price text pattern like "円"
                    price_text_content = await item.text_content() 
                    # Filter price from text content slightly risky but doable
                    import re
                    price_match = re.search(r"([\d,]+)円", price_text_content)
                    price_text = price_match.group(1) if price_match else "N/A"

                    # Verification
                    rank = "C"
                    if TextMatcher.contains_management_number(title, self.management_number):
                        rank = "A"
                    
                    if self.base_image and image_src:
                         is_similar = False
                         try:
                            downloaded_img = await self.image_matcher.download_image(image_src)
                            if downloaded_img:
                                is_similar = self.image_matcher.compare_images(self.base_image, downloaded_img)
                         except:
                             pass
                         if is_similar:
                             rank = "S" if rank == "A" else "B"

                    if rank in ["S", "A", "B"]:
                        self.add_result("YahooFlea", title, price_text, item_url, rank, image_src)
                        found_any = True
                    
                except Exception as e:
                    print(f"[YahooFlea] Error parsing item: {e}")
                    continue
            
            return found_any

        except Exception as e:
            print(f"[YahooFlea] Scraper failed: {e}")
            return False
        finally:
            await page.close()


class YahooAuctionsScraper(BaseScraper):
    async def search(self, keyword: str) -> bool:
        page = await self.get_page()
        found_any = False
        try:
            print(f"[YahooAuctions] Accessing homepage...")
            await self.safe_goto(page, "https://auctions.yahoo.co.jp/")
            
            search_input_selector = "input[name='p']" # 'p' is query param
            
            try:
                # Wait for search bar
                await page.wait_for_selector(search_input_selector, timeout=10000)
                await self.browser_manager.mimic_human_behavior(page)
                
                print(f"[YahooAuctions] Entering keyword: {keyword}")
                await page.fill(search_input_selector, keyword)
                await self.browser_manager.random_sleep(0.5, 1.5)
                await page.press(search_input_selector, "Enter")
                
                # Wait for results
                await page.wait_for_load_state("domcontentloaded")
                await self.browser_manager.random_sleep(2, 4)
            except Exception as e:
                print(f"[YahooAuctions] Search interaction failed ({e}), falling back to direct URL.")
                import urllib.parse
                safe_keyword = urllib.parse.quote(keyword)
                url = f"https://auctions.yahoo.co.jp/search/search?p={safe_keyword}"
                await self.safe_goto(page, url)

            # Check for no results
            content = await page.content()
            if "一致する商品は見つかりませんでした" in content:
                print("[YahooAuctions] No items found.")
                return False

            item_selector = ".Product" # Common class for items
            try:
                await page.wait_for_selector(item_selector, timeout=5000)
            except:
                print("[YahooAuctions] No items found or timeout.")
                return False

            items = await page.query_selector_all(item_selector)
            
            for item in items[:5]:
                try:
                    title_elem = await item.query_selector(".Product__titleLink")
                    if not title_elem: continue
                    
                    title = await title_elem.text_content()
                    title = title.strip()
                    item_url = await title_elem.get_attribute("href")

                    price_elem = await item.query_selector(".Product__priceValue")
                    if price_elem:
                        price_text = await price_elem.text_content()
                    else:
                        price_text = "N/A"
                    
                    img_elem = await item.query_selector("img")
                    image_src = await img_elem.get_attribute("src") if img_elem else None

                    # Verification
                    rank = "C"
                    if TextMatcher.contains_management_number(title, self.management_number):
                        rank = "A"
                    
                    if self.base_image and image_src:
                         is_similar = False
                         try:
                            # Yahoo might strictly check Referer for images, but let's try
                            downloaded_img = await self.image_matcher.download_image(image_src)
                            if downloaded_img:
                                is_similar = self.image_matcher.compare_images(self.base_image, downloaded_img)
                         except:
                             pass
                         if is_similar:
                             rank = "S" if rank == "A" else "B"

                    if rank in ["S", "A", "B"]:
                        self.add_result("YahooAuctions", title, price_text, item_url, rank, image_src)
                        found_any = True
                    
                except Exception as e:
                    print(f"[YahooAuctions] Error parsing item: {e}")
                    continue
            
            return found_any

        except Exception as e:
            print(f"[YahooAuctions] Scraper failed: {e}")
            return False
        finally:
            await page.close()
