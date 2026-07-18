alter table user_settings add column if not exists popup_style text not null default 'ring'; -- 'ring' | 'minimal' | 'bar'
