from abc import ABC, abstractmethod
from playwright.async_api import Page
from utils.browser import BrowserManager
from utils.image_matcher import ImageMatcher
from utils.text_matcher import TextMatcher
from PIL import Image
import asyncio

class BaseScraper(ABC):
    def __init__(self, browser_manager: BrowserManager, management_number: str, base_image_path: str = None):
        self.browser_manager = browser_manager
        self.management_number = management_number
        self.base_image_path = base_image_path
        self.results = []
        self.image_matcher = ImageMatcher()
        self.base_image = None
        if self.base_image_path:
            try:
                self.base_image = Image.open(self.base_image_path)
            except Exception as e:
                print(f"Error loading base image: {e}")

    @abstractmethod
    async def search(self, keyword: str) -> bool:
        """
        Perform the search with the given keyword.
        Returns True if items were found, False otherwise.
        """
        pass

    async def get_page(self) -> Page:
        return await self.browser_manager.new_page()

    def add_result(self, site_name, title, price, url, rank, image_url=None):
        self.results.append({
            "site": site_name,
            "title": title,
            "price": price,
            "url": url,
            "rank": rank,
            "image_url": image_url
        })
        print(f"[{site_name}] Found: {title} (Rank: {rank})")

    async def safe_goto(self, page: Page, url: str):
        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=60000)
            await self.browser_manager.random_sleep()
        except Exception as e:
            print(f"Error navigating to {url}: {e}")
