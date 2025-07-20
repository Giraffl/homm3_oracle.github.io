-- Создание таблицы для хранения исследованных тайлов
CREATE TABLE explored_tiles (
    id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id NUMBER NOT NULL,
    tiles_data CLOB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_explored_tiles_user
        FOREIGN KEY (user_id)
        REFERENCES game_users(user_id)
        ON DELETE CASCADE
);

-- Создание индекса для ускорения запросов
CREATE INDEX idx_explored_tiles_user_id ON explored_tiles(user_id);

-- Комментарии к таблице и столбцам
COMMENT ON TABLE explored_tiles IS 'Хранение данных об исследованных тайлах для каждого пользователя';
COMMENT ON COLUMN explored_tiles.id IS 'Уникальный идентификатор записи';
COMMENT ON COLUMN explored_tiles.user_id IS 'Идентификатор пользователя';
COMMENT ON COLUMN explored_tiles.tiles_data IS 'JSON с данными об исследованных тайлах';
COMMENT ON COLUMN explored_tiles.created_at IS 'Дата и время создания записи';
COMMENT ON COLUMN explored_tiles.updated_at IS 'Дата и время последнего обновления'; 