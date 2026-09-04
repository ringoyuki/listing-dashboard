from .base import BaseScraper
from utils.text_matcher import TextMatcher

class RakumaScraper(BaseScraper):
    async def search(self):
        page = await self.get_page()
        try:
            # Human-like behavior
            print(f"[Rakuma] Accessing homepage...")
            await self.safe_goto(page, "https://fril.jp/")
            
            search_input_selector = "input[name='query']" # Rakuma search input
            
            try:
                # Wait for search bar
                await page.wait_for_selector(search_input_selector, state="visible", timeout=10000)
                await self.browser_manager.mimic_human_behavior(page)
                
                print(f"[Rakuma] Entering keyword: {keyword}")
                await page.fill(search_input_selector, keyword)
                await self.browser_manager.random_sleep(0.5, 1.5)
                await page.press(search_input_selector, "Enter")
                
                # Wait for results
                await page.wait_for_load_state("domcontentloaded")
                await self.browser_manager.random_sleep(2, 4)
            except Exception as e:
                print(f"[Rakuma] Search interaction failed ({e}), falling back to direct URL.")
                import urllib.parse
                safe_keyword = urllib.parse.quote(keyword)
                url = f"https://fril.jp/s?query={safe_keyword}"
                await self.safe_goto(page, url)

            # Check for no results
            content = await page.content()
            if "検索結果 0件" in content or "商品が見つかりませんでした" in content:
                print("[Rakuma] No items found.")
                return False

            # Selector for items: .item-box or .item
            item_selector = ".item-box"
            try:
                 await page.wait_for_selector(item_selector, timeout=5000)
            except:
                 # Try fallback selector if layout changed
                 item_selector = "div[class*='item']" 
                 try:
                    await page.wait_for_selector(item_selector, timeout=5000)
                 except:   
                    print("[Rakuma] No items items container found.")
                    return False

            items = await page.query_selector_all(item_selector)
            if not items:
                print("[Rakuma] No items found in list.")
                return False

            for item in items[:5]:
                try:
                    # Link
                    link_elem = await item.query_selector("a")
                    if not link_elem: continue
                    item_url = await link_elem.get_attribute("href")
                    
                    # Title
                    title_elem = await item.query_selector("span[class*='item-box__item-name']")
                    # Rakuma sometimes puts title in img alt
                    img_elem = await item.query_selector("img")
                    
                    if title_elem:
                        title = await title_elem.text_content()
                        title = title.strip()
                    elif img_elem:
                        title = await img_elem.get_attribute("alt")
                    else:
                        title = "No Title"

                    # Price
                    price_elem = await item.query_selector(".item-box__item-price")
                    if price_elem:
                        price_text = await price_elem.text_content()
                    else:
                        price_text = "N/A"

                    # Image
                    image_src = await img_elem.get_attribute("src") if img_elem else None

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
                        self.add_result("Rakuma", title, price_text, item_url, rank, image_src)
                        found_any = True
                    
                    # Special handling for keyword search (Title search)
                    # If we found items based on Title search, we consider it a success even if ID/Image didn't match perfectly yet?
                    # User wants to find THE item. If searching by Title "Adidas Shoes", we get many.
                    # But if we search by Title1 (Specific Title), and get results, we assume we are on right track.
                    # However, simply returning "True" because we found *any* result for a title might be misleading if it's not the right item.
                    # BUT, if we return False, main.py goes to next keyword.
                    # If searching by "Specific Title" yields results, we probably don't want to fallback to "Generic Management Number" immediately unless we are sure.
                    # For now, let's stick to: "Found Any" = True.
                    found_any = True

                except Exception as e:
                    print(f"[Rakuma] Error parsing item: {e}")

        except Exception as e:
            print(f"[Rakuma] Scraper failed: {e}")
        finally:
            await page.close()
