<?php

namespace App\Services;

use Illuminate\Support\Facades\Storage;
use RuntimeException;

class ImageWatermarkService
{
    public function store(string $path, string $bytes): void
    {
        if (! Storage::disk('public')->put($path, $this->apply($bytes))) {
            throw new RuntimeException('No fue posible guardar la imagen con marca de agua.');
        }
    }

    public function apply(string $bytes): string
    {
        $info = @getimagesizefromstring($bytes);
        $image = @imagecreatefromstring($bytes);
        $logo = @imagecreatefrompng(public_path('programandoweb/brand/logo-gaspronal-horizontal-full-color.png'));
        if (! $image || ! $logo || ! $info) {
            if ($image) imagedestroy($image);
            if ($logo) imagedestroy($logo);
            throw new RuntimeException('No fue posible procesar la imagen o el logotipo de marca de agua.');
        }

        try {
            imagepalettetotruecolor($image);
            imagesavealpha($image, true);
            imagealphablending($image, true);
            $scale = min(imagesx($image) * 0.5 / imagesx($logo), imagesy($image) * 0.5 / imagesy($logo), 1);
            $width = max(1, (int) round(imagesx($logo) * $scale));
            $height = max(1, (int) round(imagesy($logo) * $scale));
            $overlay = imagecreatetruecolor($width, $height);
            imagealphablending($overlay, false);
            imagesavealpha($overlay, true);
            imagefill($overlay, 0, 0, imagecolorallocatealpha($overlay, 0, 0, 0, 127));
            imagecopyresampled($overlay, $logo, 0, 0, 0, 0, $width, $height, imagesx($logo), imagesy($logo));
            // Preserve the PNG alpha while multiplying its opacity by 20%.
            for ($y = 0; $y < $height; $y++) {
                for ($x = 0; $x < $width; $x++) {
                    $color = imagecolorat($overlay, $x, $y);
                    $alpha = (int) round(127 - (127 - (($color >> 24) & 127)) * 0.20);
                    imagesetpixel($overlay, $x, $y, ($alpha << 24) | ($color & 0xFFFFFF));
                }
            }
            imagecopy($image, $overlay, (int) floor((imagesx($image) - $width) / 2), (int) floor((imagesy($image) - $height) / 2), 0, 0, $width, $height);
            imagedestroy($overlay);
            ob_start();
            try {
                $ok = match ($info['mime']) {
                    'image/jpeg' => imagejpeg($image, null, 90),
                    'image/png' => imagepng($image),
                    'image/webp' => imagewebp($image, null, 90),
                    default => false,
                };
                $result = ob_get_contents();
            } finally {
                ob_end_clean();
            }
            if (! $ok || ! $result) throw new RuntimeException('Formato de imagen no compatible con marca de agua.');
            return $result;
        } finally {
            imagedestroy($image);
            imagedestroy($logo);
        }
    }
}
