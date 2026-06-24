"""Social sharing service - generate cards and QR codes"""
import io
import qrcode
from PIL import Image, ImageDraw, ImageFont
from typing import Optional
import base64
from datetime import datetime

from app.logger import get_logger

logger = get_logger(__name__)


class SharingService:
    """Service for generating shareable content cards"""

    def __init__(self):
        self.card_width = 800
        self.card_height = 1000
        self.bg_color = (255, 253, 247)  # Warm off-white
        self.primary_color = (31, 41, 51)  # Ink
        self.accent_color = (63, 154, 104)  # Green

    def generate_imagined_animal_card(
        self,
        animal_name: str,
        description: str,
        features: list,
        child_name: str,
        child_age: Optional[int] = None
    ) -> bytes:
        """Generate a shareable card for an imagined animal"""
        try:
            # Create blank canvas
            img = Image.new('RGB', (self.card_width, self.card_height), self.bg_color)
            draw = ImageDraw.Draw(img)

            # Add decorative header
            header_height = 120
            draw.rectangle(
                [(0, 0), (self.card_width, header_height)],
                fill=self.accent_color
            )

            # Try to load fonts, fallback to default if not available
            try:
                title_font = ImageFont.truetype("msyh.ttc", 48)  # Microsoft YaHei
                subtitle_font = ImageFont.truetype("msyh.ttc", 28)
                body_font = ImageFont.truetype("msyh.ttc", 24)
                small_font = ImageFont.truetype("msyh.ttc", 20)
            except:
                # Fallback to default font
                title_font = ImageFont.load_default()
                subtitle_font = ImageFont.load_default()
                body_font = ImageFont.load_default()
                small_font = ImageFont.load_default()

            # Draw title
            title = "我想象的动物"
            title_bbox = draw.textbbox((0, 0), title, font=title_font)
            title_x = (self.card_width - (title_bbox[2] - title_bbox[0])) // 2
            draw.text((title_x, 40), title, fill=(255, 255, 255), font=title_font)

            # Draw animal name
            y_pos = header_height + 60
            name_bbox = draw.textbbox((0, 0), animal_name, font=subtitle_font)
            name_x = (self.card_width - (name_bbox[2] - name_bbox[0])) // 2
            draw.text((name_x, y_pos), animal_name, fill=self.primary_color, font=subtitle_font)

            # Draw description
            y_pos += 80
            padding = 60
            max_width = self.card_width - 2 * padding

            # Word wrap description
            words = description.split()
            lines = []
            current_line = []

            for word in words:
                test_line = ' '.join(current_line + [word])
                bbox = draw.textbbox((0, 0), test_line, font=body_font)
                if bbox[2] - bbox[0] <= max_width:
                    current_line.append(word)
                else:
                    if current_line:
                        lines.append(' '.join(current_line))
                    current_line = [word]

            if current_line:
                lines.append(' '.join(current_line))

            for line in lines[:6]:  # Limit to 6 lines
                draw.text((padding, y_pos), line, fill=self.primary_color, font=body_font)
                y_pos += 40

            # Draw features
            if features:
                y_pos += 40
                draw.text((padding, y_pos), "特征：", fill=self.accent_color, font=subtitle_font)
                y_pos += 50

                for feature in features[:5]:  # Limit to 5 features
                    # Draw bullet point
                    draw.ellipse([(padding, y_pos + 8), (padding + 12, y_pos + 20)], fill=self.accent_color)
                    draw.text((padding + 24, y_pos), feature, fill=self.primary_color, font=body_font)
                    y_pos += 45

            # Draw creator info at bottom
            y_pos = self.card_height - 120
            creator_text = f"创作者：{child_name}"
            if child_age:
                creator_text += f"（{child_age}岁）"

            draw.text((padding, y_pos), creator_text, fill=self.primary_color, font=small_font)

            # Draw timestamp
            timestamp = datetime.now().strftime("%Y年%m月%d日")
            draw.text((padding, y_pos + 35), timestamp, fill=(107, 112, 119), font=small_font)

            # Draw app name at bottom right
            app_text = "苹果布丁动物乐园"
            bbox = draw.textbbox((0, 0), app_text, font=small_font)
            draw.text(
                (self.card_width - padding - (bbox[2] - bbox[0]), y_pos + 35),
                app_text,
                fill=self.accent_color,
                font=small_font
            )

            # Convert to bytes
            buffer = io.BytesIO()
            img.save(buffer, format='PNG')
            buffer.seek(0)

            logger.info("Generated imagined animal card", animal=animal_name)
            return buffer.getvalue()

        except Exception as e:
            logger.error("Failed to generate animal card", error=str(e), exc_info=True)
            raise

    def generate_story_card(
        self,
        title: str,
        content: str,
        child_name: str,
        child_age: Optional[int] = None
    ) -> bytes:
        """Generate a shareable card for a story"""
        try:
            img = Image.new('RGB', (self.card_width, self.card_height), self.bg_color)
            draw = ImageDraw.Draw(img)

            # Decorative header
            header_height = 120
            draw.rectangle(
                [(0, 0), (self.card_width, header_height)],
                fill=(38, 120, 199)  # Blue
            )

            try:
                title_font = ImageFont.truetype("msyh.ttc", 48)
                subtitle_font = ImageFont.truetype("msyh.ttc", 32)
                body_font = ImageFont.truetype("msyh.ttc", 24)
                small_font = ImageFont.truetype("msyh.ttc", 20)
            except:
                title_font = ImageFont.load_default()
                subtitle_font = ImageFont.load_default()
                body_font = ImageFont.load_default()
                small_font = ImageFont.load_default()

            # Draw header
            header_text = "我的故事"
            bbox = draw.textbbox((0, 0), header_text, font=title_font)
            header_x = (self.card_width - (bbox[2] - bbox[0])) // 2
            draw.text((header_x, 40), header_text, fill=(255, 255, 255), font=title_font)

            # Draw story title
            y_pos = header_height + 60
            padding = 60

            # Word wrap title
            title_lines = self._wrap_text(draw, title, subtitle_font, self.card_width - 2 * padding)
            for line in title_lines[:2]:  # Max 2 lines for title
                bbox = draw.textbbox((0, 0), line, font=subtitle_font)
                title_x = (self.card_width - (bbox[2] - bbox[0])) // 2
                draw.text((title_x, y_pos), line, fill=self.primary_color, font=subtitle_font)
                y_pos += 50

            # Draw decorative line
            y_pos += 20
            draw.line(
                [(padding, y_pos), (self.card_width - padding, y_pos)],
                fill=self.accent_color,
                width=2
            )
            y_pos += 40

            # Draw story content
            content_lines = self._wrap_text(draw, content, body_font, self.card_width - 2 * padding)
            for line in content_lines[:20]:  # Limit lines
                draw.text((padding, y_pos), line, fill=self.primary_color, font=body_font)
                y_pos += 38

                if y_pos > self.card_height - 180:  # Leave space for footer
                    draw.text((padding, y_pos), "...", fill=(107, 112, 119), font=body_font)
                    break

            # Draw creator info
            y_pos = self.card_height - 120
            creator_text = f"作者：{child_name}"
            if child_age:
                creator_text += f"（{child_age}岁）"

            draw.text((padding, y_pos), creator_text, fill=self.primary_color, font=small_font)

            timestamp = datetime.now().strftime("%Y年%m月%d日")
            draw.text((padding, y_pos + 35), timestamp, fill=(107, 112, 119), font=small_font)

            app_text = "苹果布丁动物乐园"
            bbox = draw.textbbox((0, 0), app_text, font=small_font)
            draw.text(
                (self.card_width - padding - (bbox[2] - bbox[0]), y_pos + 35),
                app_text,
                fill=(38, 120, 199),
                font=small_font
            )

            buffer = io.BytesIO()
            img.save(buffer, format='PNG')
            buffer.seek(0)

            logger.info("Generated story card", title=title)
            return buffer.getvalue()

        except Exception as e:
            logger.error("Failed to generate story card", error=str(e), exc_info=True)
            raise

    def _wrap_text(self, draw, text: str, font, max_width: int) -> list:
        """Helper to wrap text to fit within max_width"""
        words = text.split()
        lines = []
        current_line = []

        for word in words:
            test_line = ' '.join(current_line + [word])
            bbox = draw.textbbox((0, 0), test_line, font=font)
            if bbox[2] - bbox[0] <= max_width:
                current_line.append(word)
            else:
                if current_line:
                    lines.append(' '.join(current_line))
                current_line = [word]

        if current_line:
            lines.append(' '.join(current_line))

        return lines

    def generate_qr_code(self, url: str, size: int = 300) -> bytes:
        """Generate QR code for sharing URL"""
        try:
            qr = qrcode.QRCode(
                version=1,
                error_correction=qrcode.constants.ERROR_CORRECT_L,
                box_size=10,
                border=4,
            )
            qr.add_data(url)
            qr.make(fit=True)

            img = qr.make_image(fill_color=self.primary_color, back_color=self.bg_color)
            img = img.resize((size, size))

            buffer = io.BytesIO()
            img.save(buffer, format='PNG')
            buffer.seek(0)

            logger.info("Generated QR code", url=url)
            return buffer.getvalue()

        except Exception as e:
            logger.error("Failed to generate QR code", error=str(e), exc_info=True)
            raise

    def image_to_base64(self, image_bytes: bytes) -> str:
        """Convert image bytes to base64 string for embedding"""
        return base64.b64encode(image_bytes).decode('utf-8')
