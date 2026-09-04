import difflib

class TextMatcher:
    @staticmethod
    def contains_management_number(text: str, management_number: str) -> bool:
        """
        Check if the management number is in the text (case-insensitive).
        """
        if not text or not management_number:
            return False
        return management_number.lower() in text.lower()

    @staticmethod
    def calculate_similarity(text1: str, text2: str) -> float:
        """
        Calculate similarity ratio between two texts (0.0 to 1.0).
        Using SequenceMatcher.
        """
        if not text1 or not text2:
            return 0.0
        return difflib.SequenceMatcher(None, text1, text2).ratio()

    @staticmethod
    def is_title_similar(title1: str, title2: str, threshold=0.7) -> bool:
        """
        Check if titles are similar above a threshold.
        """
        return TextMatcher.calculate_similarity(title1, title2) >= threshold

    @staticmethod
    def contains_keywords(text: str, keywords: list[str]) -> bool:
        """
        Check if any of the keywords are present in the text.
        """
        if not text or not keywords:
            return False
        text_lower = text.lower()
        for kw in keywords:
            if kw.lower() in text_lower:
                return True
        return False
