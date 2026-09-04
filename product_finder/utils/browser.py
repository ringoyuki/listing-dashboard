import asyncio
import random
import os
from playwright.async_api import async_playwright, Page, BrowserContext
from playwright_stealth import Stealth
from dotenv import load_dotenv

load_dotenv()

# Scrapeless Proxy Settings from Env or Default
PROXY_SERVER = os.getenv("PROXY_SERVER", "http://proxy.scrapeless.com:8000")
PROXY_USERNAME = os.getenv("PROXY_USERNAME", "your_username")
PROXY_PASSWORD = os.getenv("PROXY_PASSWORD", "your_password")

class BrowserManager:
    def __init__(self, headless=True):
        self.headless = headless
        self.playwright = None
        self.browser = None
        self.context = None

    async def __aenter__(self):
        self.playwright = await async_playwright().start()
        
        # PROXY settings removed as per user request (Direct Connection)
        # Using stealth and longer delays instead

        try:
            self.browser = await self.playwright.chromium.launch(
                headless=self.headless,
                # proxy=proxy_settings  <-- Disabled
            )
        except Exception as e:
            print(f"Failed to launch browser: {e}")
            raise e

        self.context = await self.browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
            locale="ja-JP"
        )
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.context:
            await self.context.close()
        if self.browser:
            await self.browser.close()
        if self.playwright:
            await self.playwright.stop()

    async def new_page(self) -> Page:
        if not self.context:
            raise RuntimeError("Browser context not initialized")
        
        page = await self.context.new_page()
        # Use updated Stealth API
        await Stealth().apply_stealth_async(page)
        return page

    @staticmethod
    async def random_sleep(min_seconds=3.0, max_seconds=7.0):
        """Increased wait time for direct connection safety"""
        await asyncio.sleep(random.uniform(min_seconds, max_seconds))

    @staticmethod
    async def mimic_human_behavior(page: Page):
        """Scroll and wait randomly to mimic human behavior."""
        await page.mouse.wheel(0, random.randint(300, 700))
        await asyncio.sleep(random.uniform(1, 2))
        await page.mouse.wheel(0, -random.randint(100, 300))
        await asyncio.sleep(random.uniform(0.5, 1.5))
