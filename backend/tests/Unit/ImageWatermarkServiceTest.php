<?php
namespace Tests\Unit;

use App\Services\ImageWatermarkService;
use RuntimeException;
use Tests\TestCase;

class ImageWatermarkServiceTest extends TestCase
{
    public function test_formats_dimensions_and_center_watermark(): void
    {
        foreach (['png', 'jpeg', 'webp'] as $format) {
            $image = imagecreatetruecolor(800, 600);
            imagefill($image, 0, 0, imagecolorallocate($image, 255, 255, 255));
            ob_start();
            ('image'.$format)($image);
            $bytes = ob_get_clean();
            imagedestroy($image);
            $result = app(ImageWatermarkService::class)->apply($bytes);
            $info = getimagesizefromstring($result);
            $this->assertSame(800, $info[0]);
            $this->assertSame(600, $info[1]);
            $this->assertSame('image/'.$format, $info['mime']);
            $output = imagecreatefromstring($result);
            $corner = imagecolorsforindex($output, imagecolorat($output, 0, 0));
            $this->assertGreaterThanOrEqual(250, $corner['red']);
            $changed = false;
            for ($y = 150; $y < 450; $y += 5) {
                for ($x = 200; $x < 600; $x += 5) {
                    $pixel = imagecolorsforindex($output, imagecolorat($output, $x, $y));
                    if (min($pixel['red'], $pixel['green'], $pixel['blue']) < 245) {
                        $changed = true;
                        $this->assertGreaterThanOrEqual(190, min($pixel['red'], $pixel['green'], $pixel['blue']));
                    }
                }
            }
            $this->assertTrue($changed);
            imagedestroy($output);
        }
    }
    public function test_invalid_image_is_rejected(): void
    {
        $this->expectException(RuntimeException::class);
        app(ImageWatermarkService::class)->apply('not an image');
    }
}
