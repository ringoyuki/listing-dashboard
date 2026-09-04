import io
import aiohttp
import imagehash
from PIL import Image
import numpy as np

class ImageMatcher:
    def __init__(self, threshold=10):
        """
        :param threshold: Hamming distance threshold for image similarity.
                          Lower means stricter match. 10 is roughly 90%+ similar for 64-bit hash.
        """
        self.threshold = threshold

    async def download_image(self, url: str) -> Image.Image:
        """Download image from URL and convert to PIL Image."""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(url, timeout=10) as response:
                    if response.status == 200:
                        data = await response.read()
                        return Image.open(io.BytesIO(data))
        except Exception as e:
            print(f"Failed to download image from {url}: {e}")
            return None
    
    def calculate_hash(self, image: Image.Image):
        """Calculate dhash of an image."""
        try:
            return imagehash.dhash(image)
        except Exception as e:
            print(f"Failed to calculate hash: {e}")
            return None

    def compare_images(self, img1: Image.Image, img2: Image.Image) -> bool:
        """
        Compare two images. Returns True if similar.
        """
        hash1 = self.calculate_hash(img1)
        hash2 = self.calculate_hash(img2)
        
        if hash1 is None or hash2 is None:
            return False
            
        distance = hash1 - hash2
        return distance <= self.threshold

    def compare_with_url(self, base_image: Image.Image, target_url: str) -> bool:
        # Note: This is synchronous wrapper for simplicity if needed, but for async flow 
        # better to separate download and compare in the main logic to avoid async in non-async method or manage loops.
        # However, since we are in async playwright context, we should probably expose async methods.
        pass

async def compare_images_async(base_image: Image.Image, target_url: str, threshold=10) -> bool:
    matcher = ImageMatcher(threshold)
    target_img = await matcher.download_image(target_url)
    if target_img:
        return matcher.compare_images(base_image, target_img)
    return False
