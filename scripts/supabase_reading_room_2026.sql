-- ======================================================================================
-- SENEXAM 2026 - MIGRATION SUPABASE CHO TÍNH NĂNG ĐỌC SÁCH (SENREAD /read)
-- 1. Bảng reading_books: Không gian riêng (user) và Không gian chung (admin)
-- 2. Bảng reading_chapters: Các chương truyện, hỗ trợ bản dịch VI/EN và hình minh họa
-- 3. Row Level Security (RLS) bảo vệ bản thảo riêng tư và quyền đăng của Admin
-- ======================================================================================

-- --------------------------------------------------------------------------------------
-- PHẦN 1: BẢNG READING_BOOKS (KHO SÁCH & BẢN THẢO)
-- --------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reading_books (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  author text DEFAULT 'Khuyết danh',
  description text,
  cover_url text,
  genre text DEFAULT 'Văn học',
  language text DEFAULT 'vi', -- 'vi' | 'en'
  is_public boolean DEFAULT false, -- false = Không gian riêng, true = Không gian chung (Admin)
  views_count integer DEFAULT 0,
  total_chapters integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Bổ sung phòng ngừa nếu bảng đã tồn tại từ trước
ALTER TABLE public.reading_books ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.reading_books ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE public.reading_books ADD COLUMN IF NOT EXISTS author text DEFAULT 'Khuyết danh';
ALTER TABLE public.reading_books ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.reading_books ADD COLUMN IF NOT EXISTS cover_url text;
ALTER TABLE public.reading_books ADD COLUMN IF NOT EXISTS genre text DEFAULT 'Văn học';
ALTER TABLE public.reading_books ADD COLUMN IF NOT EXISTS language text DEFAULT 'vi';
ALTER TABLE public.reading_books ADD COLUMN IF NOT EXISTS is_public boolean DEFAULT false;
ALTER TABLE public.reading_books ADD COLUMN IF NOT EXISTS views_count integer DEFAULT 0;
ALTER TABLE public.reading_books ADD COLUMN IF NOT EXISTS total_chapters integer DEFAULT 0;
ALTER TABLE public.reading_books ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE public.reading_books ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_reading_books_user ON public.reading_books(user_id);
CREATE INDEX IF NOT EXISTS idx_reading_books_public ON public.reading_books(is_public);
CREATE INDEX IF NOT EXISTS idx_reading_books_created ON public.reading_books(created_at DESC);

-- --------------------------------------------------------------------------------------
-- PHẦN 2: BẢNG READING_CHAPTERS (CÁC CHƯƠNG TRUYỆN & MINH HỌA)
-- --------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reading_chapters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid NOT NULL REFERENCES public.reading_books(id) ON DELETE CASCADE,
  chapter_number integer NOT NULL DEFAULT 1,
  title text NOT NULL,
  content text NOT NULL,
  translation_en text,
  translation_vi text,
  illustrations jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.reading_chapters ADD COLUMN IF NOT EXISTS book_id uuid;
ALTER TABLE public.reading_chapters ADD COLUMN IF NOT EXISTS chapter_number integer DEFAULT 1;
ALTER TABLE public.reading_chapters ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE public.reading_chapters ADD COLUMN IF NOT EXISTS content text;
ALTER TABLE public.reading_chapters ADD COLUMN IF NOT EXISTS translation_en text;
ALTER TABLE public.reading_chapters ADD COLUMN IF NOT EXISTS translation_vi text;
ALTER TABLE public.reading_chapters ADD COLUMN IF NOT EXISTS illustrations jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.reading_chapters ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE public.reading_chapters ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_reading_chapters_book_num ON public.reading_chapters(book_id, chapter_number ASC);

-- --------------------------------------------------------------------------------------
-- PHẦN 3: ROW LEVEL SECURITY (RLS) AN TOÀN
-- --------------------------------------------------------------------------------------
ALTER TABLE public.reading_books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reading_chapters ENABLE ROW LEVEL SECURITY;

-- 1. Policies cho reading_books:
-- Mọi người đều xem được sách công khai, hoặc sách do chính mình tạo
DROP POLICY IF EXISTS "Public or own books can be viewed" ON public.reading_books;
CREATE POLICY "Public or own books can be viewed" ON public.reading_books
  FOR SELECT
  USING (
    is_public = true 
    OR auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'collab'))
  );

-- Thêm sách: user thêm sách riêng; chỉ admin được đặt is_public = true
DROP POLICY IF EXISTS "Users can insert own books" ON public.reading_books;
CREATE POLICY "Users can insert own books" ON public.reading_books
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND (
      is_public = false 
      OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'collab'))
    )
  );

-- Cập nhật sách: tác giả sửa sách riêng; admin sửa được mọi sách
DROP POLICY IF EXISTS "Users can update own books" ON public.reading_books;
CREATE POLICY "Users can update own books" ON public.reading_books
  FOR UPDATE
  USING (
    (auth.uid() = user_id AND is_public = false)
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'collab'))
  )
  WITH CHECK (
    (auth.uid() = user_id AND is_public = false)
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'collab'))
  );

-- Xóa sách: tác giả xóa sách riêng; admin xóa được mọi sách
DROP POLICY IF EXISTS "Users can delete own books" ON public.reading_books;
CREATE POLICY "Users can delete own books" ON public.reading_books
  FOR DELETE
  USING (
    (auth.uid() = user_id AND is_public = false)
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'collab'))
  );

-- 2. Policies cho reading_chapters:
-- Xem chương: nếu xem được sách thì xem được chương
DROP POLICY IF EXISTS "View chapters of accessible books" ON public.reading_chapters;
CREATE POLICY "View chapters of accessible books" ON public.reading_chapters
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.reading_books b 
      WHERE b.id = reading_chapters.book_id 
        AND (b.is_public = true OR b.user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'collab')))
    )
  );

-- Thêm chương: tác giả sách riêng hoặc admin
DROP POLICY IF EXISTS "Insert chapters to own books" ON public.reading_chapters;
CREATE POLICY "Insert chapters to own books" ON public.reading_chapters
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.reading_books b 
      WHERE b.id = reading_chapters.book_id 
        AND ((b.user_id = auth.uid() AND b.is_public = false) OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'collab')))
    )
  );

-- Sửa chương:
DROP POLICY IF EXISTS "Update chapters of own books" ON public.reading_chapters;
CREATE POLICY "Update chapters of own books" ON public.reading_chapters
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.reading_books b 
      WHERE b.id = reading_chapters.book_id 
        AND ((b.user_id = auth.uid() AND b.is_public = false) OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'collab')))
    )
  );

-- Xóa chương:
DROP POLICY IF EXISTS "Delete chapters of own books" ON public.reading_chapters;
CREATE POLICY "Delete chapters of own books" ON public.reading_chapters
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.reading_books b 
      WHERE b.id = reading_chapters.book_id 
        AND ((b.user_id = auth.uid() AND b.is_public = false) OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'collab')))
    )
  );

-- --------------------------------------------------------------------------------------
-- PHẦN 4: THÊM DỮ LIỆU SÁCH KINH ĐIỂN CHỌN LỌC VÀO KHÔNG GIAN CHUNG (PUBLIC SPACE)
-- --------------------------------------------------------------------------------------
DO $$
DECLARE
  v_book1_id uuid := 'b0000001-0000-0000-0000-000000000001'::uuid;
  v_book2_id uuid := 'b0000002-0000-0000-0000-000000000002'::uuid;
BEGIN
  -- Tác phẩm 1: Hoàng Tử Bé (The Little Prince) - Song ngữ & Minh họa
  INSERT INTO public.reading_books (id, user_id, title, author, description, cover_url, genre, language, is_public, total_chapters)
  VALUES (
    v_book1_id,
    NULL,
    'Hoàng Tử Bé (The Little Prince)',
    'Antoine de Saint-Exupéry',
    'Tác phẩm văn học kinh điển về tình yêu, sự kết nối và góc nhìn thuần khiết của trẻ thơ về vũ trụ loài người. Hỗ trợ đọc song ngữ và minh họa nghệ thuật.',
    'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?q=80&w=800&auto=format&fit=crop',
    'Văn học cổ điển',
    'vi',
    true,
    2
  )
  ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    is_public = true;

  -- Chương 1 của Hoàng Tử Bé
  INSERT INTO public.reading_chapters (book_id, chapter_number, title, content, translation_en, translation_vi)
  VALUES (
    v_book1_id,
    1,
    'Chương 1: Bức tranh con trăn nuốt con voi',
    'Năm lên sáu tuổi, tôi đã nhìn thấy một bức tranh tuyệt đẹp trong một cuốn sách viết về Rừng Nguyên Thủy có tựa đề là "Những câu chuyện có thật". Bức tranh vẽ một con trăn khổng lồ đang nuốt chửng một con thú dữ.

[ILLUSTRATION: Tranh vẽ phác thảo một con trăn lớn cuộn mình trong rừng rậm hoang sơ dưới ánh trăng huyền ảo]

Cuốn sách viết rằng: "Những con trăn nuốt trọn con mồi mà không cần nhai. Sau đó chúng không thể di chuyển được nữa và phải ngủ liền trong sáu tháng để tiêu hóa."

Tôi đã suy nghĩ rất nhiều về những cuộc phiêu lưu nơi rừng thẳm, rồi cầm chiếc bút chì màu vẽ nên bức tranh đầu tiên của đời mình. Tôi đã cho người lớn xem kiệt tác ấy và hỏi họ có thấy sợ không. Họ trả lời: "Tại sao lại phải sợ một cái mũ?". Bức tranh của tôi không phải là cái mũ, mà là một con trăn đang tiêu hóa một con voi bên trong bụng nó.',
    'Once when I was six years old I saw a magnificent picture in a book, called True Stories from Nature, about the primeval forest. It was a picture of a boa constrictor in the act of swallowing an animal.

[ILLUSTRATION: Sketch of a giant boa constrictor coiled in a primeval moonlit jungle]

In the book it said: "Boa constrictors swallow their prey whole, without chewing it. After that they are not able to move, and they sleep through the six months which they need for digestion."

I pondered deeply, then, over the adventures of the jungle. And after some work with a colored pencil I succeeded in making my first drawing. My Drawing Number One. I showed my masterpiece to the grown-ups, and asked them whether the drawing frightened them. But they answered: "Frighten? Why should any one be frightened by a hat?" My drawing was not a picture of a hat. It was a picture of a boa constrictor digesting an elephant.',
    'Năm lên sáu tuổi, tôi đã nhìn thấy một bức tranh tuyệt đẹp trong một cuốn sách viết về Rừng Nguyên Thủy có tựa đề là "Những câu chuyện có thật". Bức tranh vẽ một con trăn khổng lồ đang nuốt chửng một con thú dữ.'
  )
  ON CONFLICT DO NOTHING;

  -- Tác phẩm 2: Dế Mèn Phiêu Lưu Ký
  INSERT INTO public.reading_books (id, user_id, title, author, description, cover_url, genre, language, is_public, total_chapters)
  VALUES (
    v_book2_id,
    NULL,
    'Dế Mèn Phiêu Lưu Ký',
    'Tô Hoài',
    'Kiệt tác văn học thiếu nhi Việt Nam về bài học trưởng thành, lòng dũng cảm, tình bạn tri kỷ và khát vọng hòa bình thế giới muôn loài.',
    'https://images.unsplash.com/photo-1512820790803-83ca734da794?q=80&w=800&auto=format&fit=crop',
    'Truyện đồng thoại',
    'vi',
    true,
    1
  )
  ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    is_public = true;

  -- Chương 1 của Dế Mèn
  INSERT INTO public.reading_chapters (book_id, chapter_number, title, content, translation_en, translation_vi)
  VALUES (
    v_book2_id,
    1,
    'Chương 1: Bài học đường đời đầu tiên',
    'Tôi sống độc lập từ thuở bé. Ấy là tục lệ lâu đời trong họ dế chúng tôi: lứa con nào mới lớn cũng phải ra ở riêng ngay. Mẹ tôi chỉ chăm lo cho chúng tôi được vài hôm, rồi dẫn mỗi đứa đi tìm một cái hang mới để tự lập.

[ILLUSTRATION: Chú Dế Mèn dũng mãnh đứng trên ngọn cỏ non, đôi càng bóng loáng vươn cao đón ánh nắng sớm ban mai]

Tôi chẳng những không buồn mà lại rất thích. Tôi bước vào đời với đôi càng mẫm bóng, những cái vuốt ở chân thì cứng dần và nhọn hoắt. Thỉnh thoảng, ngứa chân vuốt cánh, tôi lại co cẳng lên đạp phanh phách vào các ngọn cỏ. Những ngọn cỏ gãy rạp, y như có nhát dao vừa lia qua.',
    'I lived independently since childhood. That has been an ancient tradition of our cricket family: whenever the young grow up, they must leave to live on their own immediately. My mother only took care of us for a few days, then led each child to a separate burrow to be independent.

[ILLUSTRATION: The brave cricket standing proudly on a blade of grass, sleek hind legs reaching up under the morning sun]

Not only was I not sad, but I was thrilled. I entered the world with muscular, sleek legs and claws that gradually turned razor sharp and sturdy.',
    'Tôi sống độc lập từ thuở bé. Ấy là tục lệ lâu đời trong họ dế chúng tôi: lứa con nào mới lớn cũng phải ra ở riêng ngay.'
  )
  ON CONFLICT DO NOTHING;

END $$;
