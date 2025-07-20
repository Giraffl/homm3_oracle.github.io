-- Удаление существующих объектов, если они уже созданы
BEGIN
    -- Удаление пакета
    EXECUTE IMMEDIATE 'DROP PACKAGE game_logic_pkg';
EXCEPTION
    WHEN OTHERS THEN
        NULL; -- Игнорируем ошибку, если объект не существует
END;


-- Удаление таблиц (с учетом зависимостей)
BEGIN
    -- Удаляем таблицы в правильном порядке из-за зависимостей
    EXECUTE IMMEDIATE 'DROP TABLE buildings cascade constraints';
EXCEPTION
    WHEN OTHERS THEN
        NULL;
END;


BEGIN
    EXECUTE IMMEDIATE 'DROP TABLE game_states cascade constraints';
EXCEPTION
    WHEN OTHERS THEN
        NULL;
END;


BEGIN
    EXECUTE IMMEDIATE 'DROP TABLE game_users cascade constraints';
EXCEPTION
    WHEN OTHERS THEN
        NULL;
END;

BEGIN
    EXECUTE IMMEDIATE 'DROP TABLE user_resources cascade constraints';
EXCEPTION
    WHEN OTHERS THEN
        NULL;
END;

BEGIN
    EXECUTE IMMEDIATE 'DROP TABLE army_units cascade constraints';
EXCEPTION
    WHEN OTHERS THEN
        NULL;
END;
-- Создание таблиц для игры HOMM3

-- Таблица пользователей
CREATE TABLE game_users (
    user_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    username VARCHAR2(50) UNIQUE NOT NULL,
    password VARCHAR2(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица для сохранения состояния игры
CREATE TABLE game_states (
    state_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id NUMBER NOT NULL,
    map_data CLOB NOT NULL,
    hero_x NUMBER NOT NULL,
    hero_y NUMBER NOT NULL,
    castle_x NUMBER NOT NULL,
    castle_y NUMBER NOT NULL,
    spawn_point_id NUMBER DEFAULT 0,
    current_day NUMBER DEFAULT 1,
    remaining_steps NUMBER DEFAULT 20,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_user_id FOREIGN KEY (user_id) REFERENCES game_users(user_id)
);

-- Таблица для зданий (шахты и лесопилки)
CREATE TABLE buildings (
    building_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    building_type VARCHAR2(20) NOT NULL, -- 'CASTLE', 'SAWMILL' или 'MINE'
    x_coord NUMBER NOT NULL,
    y_coord NUMBER NOT NULL,
    owner_id NUMBER,
    "level" NUMBER DEFAULT 1,
    production_rate NUMBER NOT NULL, -- Количество ресурсов, производимых в день
    ore_production NUMBER DEFAULT 0, -- Количество руды, производимой в день
    gold_production NUMBER DEFAULT 0, -- Количество золота, производимого в день
    last_collected TIMESTAMP,
    CONSTRAINT fk_owner_id FOREIGN KEY (owner_id) REFERENCES game_users(user_id)
);

-- Таблица для ресурсов пользователя
CREATE TABLE user_resources (
    user_id NUMBER PRIMARY KEY,
    wood NUMBER DEFAULT 0,
    ore NUMBER DEFAULT 0,
    gold NUMBER DEFAULT 0,
    last_collected TIMESTAMP DEFAULT SYSTIMESTAMP,
    CONSTRAINT fk_user_resources FOREIGN KEY (user_id) REFERENCES game_users(user_id)
);

-- === [АРМИЯ] ===
-- Таблица для армии
CREATE TABLE army_units (
    unit_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id NUMBER NOT NULL,
    unit_type VARCHAR2(20) NOT NULL, -- 'SWORDSMAN', 'ARCHER', 'TANK'
    count NUMBER DEFAULT 1,
    x_coord NUMBER NOT NULL,
    y_coord NUMBER NOT NULL,
    health NUMBER DEFAULT 100,
    attack NUMBER,
    defense NUMBER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_army_user FOREIGN KEY (user_id) REFERENCES game_users(user_id)
);

-- Пакет для игровой логики
CREATE OR REPLACE PACKAGE game_logic_pkg AS
    -- Регистрация пользователя
    FUNCTION register_user(p_username VARCHAR2, p_password VARCHAR2) RETURN NUMBER;
    
    -- Авторизация пользователя
    FUNCTION authenticate_user(p_username VARCHAR2, p_password VARCHAR2) RETURN NUMBER;
    
    -- Инициализация новой игры для пользователя
    PROCEDURE initialize_game(p_user_id NUMBER);
    
    -- Получение состояния игры
    PROCEDURE get_game_state(
        p_user_id IN NUMBER,
        p_map_data OUT CLOB,
        p_hero_x OUT NUMBER,
        p_hero_y OUT NUMBER,
        p_castle_x OUT NUMBER,
        p_castle_y OUT NUMBER,
        p_current_day OUT NUMBER,
        p_remaining_steps OUT NUMBER
    );
    
    -- Движение героя
    PROCEDURE move_hero(
        p_user_id IN NUMBER,
        p_new_x IN NUMBER,
        p_new_y IN NUMBER,
        p_success OUT NUMBER,
        p_message OUT VARCHAR2,
        p_current_day OUT NUMBER,
        p_remaining_steps OUT NUMBER,
        p_new_day OUT NUMBER
    );
    
    -- Проверка взаимодействия с замком
    FUNCTION check_castle_interaction(
        p_user_id IN NUMBER,
        p_hero_x IN NUMBER,
        p_hero_y IN NUMBER
    ) RETURN NUMBER;

    -- Начало нового дня
    PROCEDURE start_new_day(
        p_user_id IN NUMBER,
        p_success OUT NUMBER
    );

    -- Новые функции для работы со зданиями
    
    -- Получение информации о здании
    PROCEDURE get_building_info(
        p_x IN NUMBER,
        p_y IN NUMBER,
        p_user_id IN NUMBER,
        p_building_type OUT VARCHAR2,
        p_owner_id OUT NUMBER,
        p_production_rate OUT NUMBER,
        p_is_near OUT NUMBER
    );
    
    -- Захват здания
    PROCEDURE capture_building(
        p_user_id IN NUMBER,
        p_x IN NUMBER,
        p_y IN NUMBER,
        p_building_type IN VARCHAR2,
        p_success OUT NUMBER,
        p_message OUT VARCHAR2
    );

    -- Захват замка
    PROCEDURE capture_castle(
        p_user_id IN NUMBER,
        p_x IN NUMBER,
        p_y IN NUMBER,
        p_success OUT NUMBER,
        p_message OUT VARCHAR2
    );
    
    -- Отзыв владения замком
    PROCEDURE relinquish_castle(
        p_user_id IN NUMBER,
        p_x IN NUMBER,
        p_y IN NUMBER,
        p_success OUT NUMBER,
        p_message OUT VARCHAR2
    );
    
    -- Получение информации о замке
    PROCEDURE get_castle_info(
        p_x IN NUMBER,
        p_y IN NUMBER,
        p_user_id IN NUMBER,
        p_owner_id OUT NUMBER,
        p_production_rate OUT NUMBER
    );

    -- Функции для работы с ресурсами
    PROCEDURE add_resources_from_buildings(p_user_id IN NUMBER);
    PROCEDURE get_user_resources(p_user_id IN NUMBER, p_wood OUT NUMBER, p_ore OUT NUMBER, p_gold OUT NUMBER);
    PROCEDURE update_user_resources(p_user_id IN NUMBER, p_wood IN NUMBER, p_ore IN NUMBER, p_gold IN NUMBER);
    PROCEDURE cheat_add_resources(
        p_user_id IN NUMBER,
        p_wood IN NUMBER,
        p_ore IN NUMBER,
        p_gold IN NUMBER
    );

    -- Добавляем процедуру для улучшения здания
    PROCEDURE upgrade_building(
        p_user_id IN NUMBER,
        p_x IN NUMBER,
        p_y IN NUMBER,
        p_building_type IN VARCHAR2,
        p_result OUT NUMBER,
        p_message OUT VARCHAR2
    );

    -- === Армия ===
    PROCEDURE hire_army(
        p_user_id IN NUMBER,
        p_unit_type IN VARCHAR2,
        p_count IN NUMBER,
        p_x IN NUMBER,
        p_y IN NUMBER,
        p_result OUT NUMBER,
        p_message OUT VARCHAR2
    );
    PROCEDURE get_user_army(
        p_user_id IN NUMBER,
        p_units OUT SYS_REFCURSOR
    );
    PROCEDURE move_army(
        p_user_id IN NUMBER,
        p_unit_id IN NUMBER,
        p_new_x IN NUMBER,
        p_new_y IN NUMBER,
        p_result OUT NUMBER,
        p_message OUT VARCHAR2
    );
    PROCEDURE get_unit_types(
        p_types OUT SYS_REFCURSOR
    );
END game_logic_pkg;


CREATE OR REPLACE PACKAGE BODY game_logic_pkg AS
    -- Константы для базового производства
    c_base_wood_production CONSTANT NUMBER := 80;  -- Базовое производство дерева
    c_base_ore_production CONSTANT NUMBER := 60;   -- Базовое производство руды
    c_base_gold_production CONSTANT NUMBER := 40;  -- Базовое производство золота

    -- Регистрация пользователя
    FUNCTION register_user(p_username VARCHAR2, p_password VARCHAR2) RETURN NUMBER IS
        v_user_id NUMBER;
    BEGIN
        -- Простая проверка на существование пользователя
        BEGIN
            SELECT user_id INTO v_user_id 
            FROM game_users 
            WHERE username = p_username;
            
            -- Если пользователь найден, возвращаем -1
            RETURN -1;
        EXCEPTION
            WHEN NO_DATA_FOUND THEN
                -- Если пользователь не найден, создаем нового
                INSERT INTO game_users (username, password)
                VALUES (p_username, p_password)
                RETURNING user_id INTO v_user_id;
                
                -- Инициализируем игру для нового пользователя
                initialize_game(v_user_id);
                
                RETURN v_user_id;
        END;
    END register_user;
    
    -- Авторизация пользователя
    FUNCTION authenticate_user(p_username VARCHAR2, p_password VARCHAR2) RETURN NUMBER IS
        v_user_id NUMBER;
    BEGIN
        SELECT user_id INTO v_user_id
        FROM game_users
        WHERE username = p_username AND password = p_password;
        
        RETURN v_user_id;
    EXCEPTION
        WHEN NO_DATA_FOUND THEN
            RETURN -1;
    END authenticate_user;
    
    -- Создание карты
    FUNCTION generate_map(p_width NUMBER, p_height NUMBER) RETURN CLOB IS
        v_map CLOB;
        v_terrain_map VARCHAR2(32767);
        v_row VARCHAR2(4000);
        
        -- Типы местности:
        -- 'G' - Поле (трава, зеленая) - проходимо
        -- 'F' - Лес (темно-зеленый) - проходимо
        -- 'D' - Пустыня (желтая) - проходимо
        -- 'W' - Вода (реки, синяя) - непроходимо
        -- 'B' - Мост (коричневый) - проходимо через реку
        -- 'C' - Замок игрока (серый) - непроходимо
        -- 'E' - Вход в замок игрока (коричневый, дверь) - проходимо, позволяет взаимодействовать с замком
        -- 'X' - Вражеский замок (красный) - непроходимо
        -- 'Y' - Вход в вражеский замок (красный, дверь) - проходимо
        -- 'S' - Лесопилка (коричневый) - непроходимо
        -- 'T' - Вход в лесопилку (коричневый, дверь) - проходимо
        -- 'M' - Шахта (серый) - непроходимо
        -- 'N' - Вход в шахту (серый, дверь) - проходимо
        
        -- Вспомогательные переменные для генерации карты
        v_random NUMBER;
        v_river_points DBMS_SQL.NUMBER_TABLE; -- Точки для извилистой реки (Y-координаты)
        v_river_points_count NUMBER := 10; -- Количество контрольных точек для реки
        v_river_width NUMBER := 3; -- Ширина реки
        v_desert_start_x NUMBER;
        v_desert_end_x NUMBER;
        v_desert_start_y NUMBER;
        v_desert_end_y NUMBER;
        v_forest_centers DBMS_SQL.NUMBER_TABLE;
        v_forest_sizes DBMS_SQL.NUMBER_TABLE;
        v_forest_count NUMBER := 5; -- Количество лесных массивов
        v_bridges DBMS_SQL.NUMBER_TABLE; -- Позиции мостов по X
        v_bridge_count NUMBER := 3; -- Количество мостов
        
        -- Позиции спавна для трех игроков
        v_spawn_x DBMS_SQL.NUMBER_TABLE;
        v_spawn_y DBMS_SQL.NUMBER_TABLE;
        v_castle_size NUMBER := 3; -- Размер замка (3x3)
    BEGIN
        -- Инициализация карты полем (травой)
        FOR y IN 1..p_height LOOP
            v_row := '';
            FOR x IN 1..p_width LOOP
                v_row := v_row || 'G';
            END LOOP;
            v_terrain_map := v_terrain_map || v_row;
            IF y < p_height THEN
                v_terrain_map := v_terrain_map || CHR(10);
            END IF;
        END LOOP;
        
        -- Создаем извилистую реку
        -- Генерируем контрольные точки для реки
        FOR i IN 0..v_river_points_count-1 LOOP
            -- Y-координата каждой контрольной точки (колеблется вокруг 40% высоты карты)
            v_river_points(i) := TRUNC(p_height * 0.4) + 
                                TRUNC(DBMS_RANDOM.VALUE(-10, 10));
            
            -- Проверка на выход за границы карты
            IF v_river_points(i) < 10 THEN
                v_river_points(i) := 10;
            ELSIF v_river_points(i) > p_height - 10 THEN
                v_river_points(i) := p_height - 10;
            END IF;
        END LOOP;
        
        -- Позиции мостов через реку (по X-координате)
        FOR i IN 1..v_bridge_count LOOP
            -- Размещаем мосты равномерно по ширине карты
            v_bridges(i) := TRUNC(p_width * i / (v_bridge_count + 1));
        END LOOP;
        
        -- Генерируем пустыню в южной части карты (более естественная форма)
        v_desert_start_x := TRUNC(p_width * 0.1);
        v_desert_end_x := TRUNC(p_width * 0.9);
        v_desert_start_y := TRUNC(p_height * 0.7);
        v_desert_end_y := p_height;
        
        -- Генерируем центры лесных массивов
        FOR i IN 1..v_forest_count LOOP
            v_forest_centers(i * 2 - 1) := TRUNC(DBMS_RANDOM.VALUE(10, p_width - 10)); -- X
            v_forest_centers(i * 2) := TRUNC(DBMS_RANDOM.VALUE(10, v_desert_start_y - 10)); -- Y
            v_forest_sizes(i) := TRUNC(DBMS_RANDOM.VALUE(3, 8)); -- Размер леса
        END LOOP;
        
        -- Определяем точки спавна для трех игроков (в разных частях карты)
        -- Игрок 1 - левый верхний угол
        v_spawn_x(1) := TRUNC(p_width * 0.2);
        v_spawn_y(1) := TRUNC(p_height * 0.2);
        
        -- Игрок 2 - правый верхний угол
        v_spawn_x(2) := TRUNC(p_width * 0.8);
        v_spawn_y(2) := TRUNC(p_height * 0.2);
        
        -- Игрок 3 - центр нижней части (пустыня)
        v_spawn_x(3) := TRUNC(p_width * 0.5);
        v_spawn_y(3) := TRUNC(p_height * 0.8);
        
        -- Применяем генерацию на карту
        -- Разбиваем CLOB карты на строки
        DECLARE
            v_map_lines DBMS_SQL.VARCHAR2A;
            v_line_count NUMBER := 1;
            v_curr_line VARCHAR2(4000);
            v_prev_char CHAR(1);
            v_prev_line VARCHAR2(4000);
            v_lines_array DBMS_SQL.VARCHAR2A;
            v_current_y NUMBER := 1;
            
            -- Функция для интерполяции точек реки
            FUNCTION interpolate_river_y(x NUMBER) RETURN NUMBER IS
                v_segment_width NUMBER := p_width / (v_river_points_count - 1);
                v_segment_index NUMBER := FLOOR(x / v_segment_width);
                v_segment_pos NUMBER := MOD(x, v_segment_width) / v_segment_width;
                v_y1 NUMBER;
                v_y2 NUMBER;
            BEGIN
                -- Убедимся, что не выходим за границу массива
                IF v_segment_index >= v_river_points_count - 1 THEN
                    v_segment_index := v_river_points_count - 2;
                    v_segment_pos := 1;
                END IF;
                
                v_y1 := v_river_points(v_segment_index);
                v_y2 := v_river_points(v_segment_index + 1);
                
                -- Линейная интерполяция
                RETURN v_y1 + (v_y2 - v_y1) * v_segment_pos;
            END;
            
            -- Функция для определения расстояния между точками
            FUNCTION distance(x1 NUMBER, y1 NUMBER, x2 NUMBER, y2 NUMBER) RETURN NUMBER IS
            BEGIN
                RETURN SQRT(POWER(x2 - x1, 2) + POWER(y2 - y1, 2));
            END;
            
        BEGIN
            -- Разбиваем карту на строки для удобства обработки
            v_prev_line := '';
            FOR i IN 1..LENGTH(v_terrain_map) LOOP
                IF SUBSTR(v_terrain_map, i, 1) = CHR(10) THEN
                    v_lines_array(v_current_y) := v_curr_line;
                    v_current_y := v_current_y + 1;
                    v_curr_line := '';
                ELSE
                    v_curr_line := v_curr_line || SUBSTR(v_terrain_map, i, 1);
                END IF;
            END LOOP;
            
            -- Добавляем последнюю строку, если она есть
            IF v_curr_line IS NOT NULL THEN
                v_lines_array(v_current_y) := v_curr_line;
            END IF;
            
            -- Генерируем извилистую реку и мосты
            FOR y IN 1..p_height LOOP
                v_curr_line := v_lines_array(y);
                
                FOR x IN 1..p_width LOOP
                    -- Вычисляем Y-координату реки в текущей X-позиции
                    v_random := interpolate_river_y(x);
                    
                    -- Если текущая Y-координата находится в пределах ширины реки от центра
                    IF ABS(y - v_random) <= v_river_width / 2 THEN
                        v_prev_char := SUBSTR(v_curr_line, x, 1);
                        
                        -- Определяем, должен ли здесь быть мост
                        v_prev_char := 'W'; -- По умолчанию вода
                        
                        FOR i IN 1..v_bridge_count LOOP
                            IF ABS(x - v_bridges(i)) <= 1 THEN -- Ширина моста 3 клетки
                                v_prev_char := 'B';
                                EXIT;
                            END IF;
                        END LOOP;
                        
                        -- Заменяем символ в строке
                        v_curr_line := SUBSTR(v_curr_line, 1, x - 1) || v_prev_char || SUBSTR(v_curr_line, x + 1);
                    END IF;
                END LOOP;
                
                v_lines_array(y) := v_curr_line;
            END LOOP;
            
            -- Генерируем пустыню с более естественной формой (не квадратной)
            FOR y IN v_desert_start_y..v_desert_end_y LOOP
                IF y <= p_height THEN
                    v_curr_line := v_lines_array(y);
                    
                    -- Определяем волнистость границы пустыни
                    v_random := SIN(y * 0.2) * 10; -- Волнистая граница
                    
                    -- Корректируем границы для текущей строки
                    v_desert_start_x := TRUNC(p_width * 0.1) + TRUNC(v_random);
                    v_desert_end_x := TRUNC(p_width * 0.9) + TRUNC(v_random);
                    
                    -- Убеждаемся, что границы не выходят за пределы карты
                    IF v_desert_start_x < 1 THEN
                        v_desert_start_x := 1;
                    END IF;
                    
                    IF v_desert_end_x > p_width THEN
                        v_desert_end_x := p_width;
                    END IF;
                    
                    FOR x IN v_desert_start_x..v_desert_end_x LOOP
                        IF x <= p_width THEN
                            v_prev_char := SUBSTR(v_curr_line, x, 1);
                            
                            -- Делаем границу пустыни более неровной
                            IF DBMS_RANDOM.VALUE(0, 1) < 0.8 THEN -- 80% шанс поставить пустыню
                                -- Если это не вода или мост, заменяем на пустыню
                                IF v_prev_char != 'W' AND v_prev_char != 'B' THEN
                                    v_curr_line := SUBSTR(v_curr_line, 1, x - 1) || 'D' || SUBSTR(v_curr_line, x + 1);
                                END IF;
                            END IF;
                        END IF;
                    END LOOP;
                    v_lines_array(y) := v_curr_line;
                END IF;
            END LOOP;
            
            -- Генерируем леса
            FOR i IN 1..v_forest_count LOOP
                DECLARE
                    v_center_x NUMBER := v_forest_centers(i * 2 - 1);
                    v_center_y NUMBER := v_forest_centers(i * 2);
                    v_size NUMBER := v_forest_sizes(i);
                BEGIN
                    FOR y IN (v_center_y - v_size)..(v_center_y + v_size) LOOP
                        IF y > 0 AND y <= p_height THEN
                            v_curr_line := v_lines_array(y);
                            FOR x IN (v_center_x - v_size)..(v_center_x + v_size) LOOP
                                IF x > 0 AND x <= p_width THEN
                                    -- Проверяем расстояние от центра леса (чтобы лес был более-менее круглым)
                                    IF POWER(x - v_center_x, 2) + POWER(y - v_center_y, 2) <= POWER(v_size, 2) THEN
                                        v_prev_char := SUBSTR(v_curr_line, x, 1);
                                        
                                        -- Если это не вода, не мост и не пустыня, заменяем на лес
                                        IF v_prev_char != 'W' AND v_prev_char != 'B' AND v_prev_char != 'D' THEN
                                            v_curr_line := SUBSTR(v_curr_line, 1, x - 1) || 'F' || SUBSTR(v_curr_line, x + 1);
                                        END IF;
                                    END IF;
                                END IF;
                            END LOOP;
                            v_lines_array(y) := v_curr_line;
                        END IF;
                    END LOOP;
                END;
            END LOOP;
            
            -- Генерируем замки для каждой спавн-точки (3x3)
            FOR player IN 1..3 LOOP
                -- Первый замок — обычный, остальные — вражеские
                DECLARE
                    castle_sym CHAR(1);
                    door_sym CHAR(1);
                BEGIN
                    IF player = 1 THEN
                        castle_sym := 'C';
                        door_sym := 'E';
                    ELSE
                        castle_sym := 'X';
                        door_sym := 'Y';
                    END IF;
                    -- Создаем замок как структуру 3x3 с дверью внизу по центру
                    FOR y IN (v_spawn_y(player) - 3)..(v_spawn_y(player) - 1) LOOP
                        IF y > 0 AND y <= p_height THEN
                            v_curr_line := v_lines_array(y);
                            FOR x IN (v_spawn_x(player) - 1)..(v_spawn_x(player) + 1) LOOP
                                IF x > 0 AND x <= p_width THEN
                                    v_prev_char := SUBSTR(v_curr_line, x, 1);
                                    IF v_prev_char != 'W' AND v_prev_char != 'B' THEN
                                        IF y = v_spawn_y(player) - 1 AND x = v_spawn_x(player) THEN
                                            v_curr_line := SUBSTR(v_curr_line, 1, x - 1) || door_sym || SUBSTR(v_curr_line, x + 1);
                                        ELSE
                                            v_curr_line := SUBSTR(v_curr_line, 1, x - 1) || castle_sym || SUBSTR(v_curr_line, x + 1);
                                        END IF;
                                    END IF;
                                END IF;
                            END LOOP;
                            v_lines_array(y) := v_curr_line;
                        END IF;
                    END LOOP;
                END;

                -- Добавляем лесопилку слева от замка (если возможно)
                FOR y IN (v_spawn_y(player) - 2)..(v_spawn_y(player) - 1) LOOP
                    IF y > 0 AND y <= p_height THEN
                        v_curr_line := v_lines_array(y);
                        
                        FOR x IN (v_spawn_x(player) - 5)..(v_spawn_x(player) - 3) LOOP
                            IF x > 0 AND x <= p_width THEN
                                v_prev_char := SUBSTR(v_curr_line, x, 1);
                                
                                IF v_prev_char != 'W' AND v_prev_char != 'B' THEN
                                    -- Если это нижняя центральная клетка - делаем дверь
                                    IF y = v_spawn_y(player) - 1 AND x = v_spawn_x(player) - 4 THEN
                                        v_curr_line := SUBSTR(v_curr_line, 1, x - 1) || 'T' || SUBSTR(v_curr_line, x + 1);
                                    ELSE
                                        v_curr_line := SUBSTR(v_curr_line, 1, x - 1) || 'S' || SUBSTR(v_curr_line, x + 1);
                                    END IF;
                                END IF;
                            END IF;
                        END LOOP;
                        
                        v_lines_array(y) := v_curr_line;
                    END IF;
                END LOOP;

                -- Добавляем шахту справа от замка (если возможно)
                FOR y IN (v_spawn_y(player) - 2)..(v_spawn_y(player) - 1) LOOP
                    IF y > 0 AND y <= p_height THEN
                        v_curr_line := v_lines_array(y);
                        
                        FOR x IN (v_spawn_x(player) + 3)..(v_spawn_x(player) + 5) LOOP
                            IF x > 0 AND x <= p_width THEN
                                v_prev_char := SUBSTR(v_curr_line, x, 1);
                                
                                IF v_prev_char != 'W' AND v_prev_char != 'B' THEN
                                    -- Если это нижняя центральная клетка - делаем дверь
                                    IF y = v_spawn_y(player) - 1 AND x = v_spawn_x(player) + 4 THEN
                                        v_curr_line := SUBSTR(v_curr_line, 1, x - 1) || 'N' || SUBSTR(v_curr_line, x + 1);
                                    ELSE
                                        v_curr_line := SUBSTR(v_curr_line, 1, x - 1) || 'M' || SUBSTR(v_curr_line, x + 1);
                                    END IF;
                                END IF;
                            END IF;
                        END LOOP;
                        
                        v_lines_array(y) := v_curr_line;
                    END IF;
                END LOOP;
            END LOOP;
            
            -- Собираем обновленную карту назад в CLOB
            FOR y IN 1..p_height LOOP
                v_map := v_map || v_lines_array(y);
                IF y < p_height THEN
                    v_map := v_map || CHR(10);
                END IF;
            END LOOP;
        END;
        
        RETURN v_map;
    END generate_map;
    
    -- Инициализация новой игры для пользователя
    PROCEDURE initialize_game(p_user_id NUMBER) IS
        v_map CLOB;
        v_map_width NUMBER := 100;
        v_map_height NUMBER := 100;
        v_hero_x NUMBER;
        v_hero_y NUMBER;
        v_castle_x NUMBER;
        v_castle_y NUMBER;
        v_spawn_point_id NUMBER := 1; -- ВСЕГДА первый спавн
        v_spawn_count NUMBER := 3; -- Число точек спавна
        v_count NUMBER;
    BEGIN
        -- Всегда используем первую точку спавна
        v_spawn_point_id := 1;
        -- Определяем координаты спавна на основе ID точки
        CASE v_spawn_point_id
            WHEN 1 THEN
                v_hero_x := TRUNC(v_map_width * 0.2);
                v_hero_y := TRUNC(v_map_height * 0.2);
                v_castle_x := v_hero_x;
                v_castle_y := v_hero_y - 2;
            WHEN 2 THEN
                v_hero_x := TRUNC(v_map_width * 0.8);
                v_hero_y := TRUNC(v_map_height * 0.2);
                v_castle_x := v_hero_x;
                v_castle_y := v_hero_y - 2;
            WHEN 3 THEN
                v_hero_x := TRUNC(v_map_width * 0.5);
                v_hero_y := TRUNC(v_map_height * 0.8);
                v_castle_x := v_hero_x;
                v_castle_y := v_hero_y - 2;
            ELSE
                v_hero_x := 50;
                v_hero_y := 25;
                v_castle_x := 50;
                v_castle_y := 23;
        END CASE;
        -- Генерируем карту
        v_map := generate_map(v_map_width, v_map_height);
        -- Проверяем, есть ли уже запись для этого пользователя
        DECLARE
            v_user_count NUMBER;
        BEGIN
            SELECT COUNT(*) INTO v_user_count
            FROM game_states
            WHERE user_id = p_user_id;
            IF v_user_count > 0 THEN
                UPDATE game_states
                SET map_data = v_map,
                    hero_x = v_hero_x,
                    hero_y = v_hero_y,
                    castle_x = v_castle_x,
                    castle_y = v_castle_y,
                    spawn_point_id = v_spawn_point_id,
                    current_day = 1,
                    remaining_steps = 20,
                    last_updated = CURRENT_TIMESTAMP
                WHERE user_id = p_user_id;
            ELSE
                INSERT INTO game_states (user_id, map_data, hero_x, hero_y, castle_x, castle_y, spawn_point_id, current_day, remaining_steps)
                VALUES (p_user_id, v_map, v_hero_x, v_hero_y, v_castle_x, v_castle_y, v_spawn_point_id, 1, 20);
            END IF;
        END;
        COMMIT;
    END initialize_game;
    
    -- Получение состояния игры
    PROCEDURE get_game_state(
        p_user_id IN NUMBER,
        p_map_data OUT CLOB,
        p_hero_x OUT NUMBER,
        p_hero_y OUT NUMBER,
        p_castle_x OUT NUMBER,
        p_castle_y OUT NUMBER,
        p_current_day OUT NUMBER,
        p_remaining_steps OUT NUMBER
    ) IS
    BEGIN
        SELECT map_data, hero_x, hero_y, castle_x, castle_y, current_day, remaining_steps
        INTO p_map_data, p_hero_x, p_hero_y, p_castle_x, p_castle_y, p_current_day, p_remaining_steps
        FROM game_states
        WHERE user_id = p_user_id;
    EXCEPTION
        WHEN NO_DATA_FOUND THEN
            p_map_data := NULL;
            p_hero_x := NULL;
            p_hero_y := NULL;
            p_castle_x := NULL;
            p_castle_y := NULL;
            p_current_day := NULL;
            p_remaining_steps := NULL;
    END get_game_state;
    
    -- Проверка взаимодействия с замком
    FUNCTION check_castle_interaction(
        p_user_id IN NUMBER,
        p_hero_x IN NUMBER,
        p_hero_y IN NUMBER
    ) RETURN NUMBER IS
        v_map_data CLOB;
        v_map_lines DBMS_SQL.VARCHAR2A;
        v_castle_found BOOLEAN := FALSE;
        v_current_tile CHAR(1);  -- Тип клетки, на которой стоит герой
        v_door_found BOOLEAN := FALSE; -- Флаг для проверки наличия двери рядом
    BEGIN
        -- Получаем карту
        SELECT map_data
        INTO v_map_data
        FROM game_states
        WHERE user_id = p_user_id;
        
        -- Преобразуем CLOB в массив строк
        DECLARE
            v_line_number NUMBER := 1;
            v_prev_pos NUMBER := 1;
            v_pos NUMBER;
            v_temp_clob CLOB := v_map_data;
        BEGIN
            LOOP
                v_pos := DBMS_LOB.INSTR(v_temp_clob, CHR(10), v_prev_pos);
                IF v_pos = 0 THEN
                    -- Последняя строка
                    v_map_lines(v_line_number) := DBMS_LOB.SUBSTR(v_temp_clob, DBMS_LOB.GETLENGTH(v_temp_clob) - v_prev_pos + 1, v_prev_pos);
                    EXIT;
                ELSE
                    v_map_lines(v_line_number) := DBMS_LOB.SUBSTR(v_temp_clob, v_pos - v_prev_pos, v_prev_pos);
                    v_prev_pos := v_pos + 1;
                    v_line_number := v_line_number + 1;
                END IF;
            END LOOP;
        END;
        
        -- Получаем тип клетки, на которой стоит герой
        v_current_tile := SUBSTR(v_map_lines(p_hero_y), p_hero_x, 1);
        
        -- Проверяем, стоит ли герой на входе в замок, лесопилку или шахту
        IF v_current_tile IN ('E', 'T', 'N') THEN
            RETURN 1;
        END IF;
        
        -- Проверяем клетки вокруг героя
        FOR y IN (p_hero_y - 1)..(p_hero_y + 1) LOOP
            IF y > 0 AND y <= v_map_lines.COUNT THEN
                FOR x IN (p_hero_x - 1)..(p_hero_x + 1) LOOP
                    IF x > 0 AND x <= LENGTH(v_map_lines(y)) THEN
                        v_current_tile := SUBSTR(v_map_lines(y), x, 1);
                        -- Если рядом есть замок, лесопилка или шахта
                        IF v_current_tile IN ('C', 'S', 'M') THEN
                            RETURN 1;
                        END IF;
                    END IF;
                END LOOP;
            END IF;
        END LOOP;
        
        RETURN 0;
    EXCEPTION
        WHEN OTHERS THEN
            DBMS_OUTPUT.PUT_LINE('Ошибка при проверке взаимодействия с замком: ' || SQLERRM);
            RETURN 0;
    END check_castle_interaction;
    
    -- Функция для проверки типа местности
    FUNCTION get_terrain_cost(
        p_terrain_type IN VARCHAR2
    ) RETURN NUMBER IS
    BEGIN
        CASE p_terrain_type
            WHEN 'D' THEN RETURN 1.0;  -- Пустыня стоит 1 шаг
            WHEN 'W' THEN RETURN NULL; -- Вода непроходима
            ELSE RETURN 0.5;           -- Все остальные типы местности стоят 0.5 шага
        END CASE;
    END get_terrain_cost;

    -- Процедура для перемещения героя
    PROCEDURE move_hero(
        p_user_id IN NUMBER,
        p_new_x IN NUMBER,
        p_new_y IN NUMBER,
        p_success OUT NUMBER,
        p_message OUT VARCHAR2,
        p_current_day OUT NUMBER,
        p_remaining_steps OUT NUMBER,
        p_new_day OUT NUMBER
    ) IS
        v_current_x NUMBER;
        v_current_y NUMBER;
        v_remaining_steps NUMBER;
        v_current_day NUMBER;
        v_map_data CLOB;
        v_terrain_type VARCHAR2(1);
        v_steps_to_subtract NUMBER;
        v_dx NUMBER;
        v_dy NUMBER;
        v_new_remaining_steps NUMBER;
    BEGIN
        -- Получаем текущее положение героя и оставшиеся шаги
        SELECT hero_x, hero_y, remaining_steps, current_day, map_data
        INTO v_current_x, v_current_y, v_remaining_steps, v_current_day, v_map_data
        FROM game_states
        WHERE user_id = p_user_id
        FOR UPDATE;  -- Add lock to prevent concurrent updates
        
        -- Вычисляем расстояние
        v_dx := ABS(p_new_x - v_current_x);
        v_dy := ABS(p_new_y - v_current_y);
        
        -- Проверяем, что перемещение происходит не более чем на 1 клетку
        IF v_dx > 1 OR v_dy > 1 OR (v_dx = 0 AND v_dy = 0) THEN
            p_success := 0;
            p_message := 'Невозможно переместиться в указанную точку';
            RETURN;
        END IF;
        
        -- Получаем тип местности в новой точке
        v_terrain_type := SUBSTR(
            REGEXP_SUBSTR(v_map_data, '[^\n]*', 1, p_new_y + 1),
            p_new_x + 1,
            1
        );
        
        -- Получаем стоимость перемещения для данного типа местности
        v_steps_to_subtract := get_terrain_cost(v_terrain_type);
        
        -- Проверяем, можно ли перемещаться на этот тип местности
        IF v_steps_to_subtract IS NULL THEN
            p_success := 0;
            p_message := 'Невозможно переместиться на этот тип местности';
            RETURN;
        END IF;
        
        -- Проверяем, достаточно ли шагов для движения
        IF v_remaining_steps + 0.001 < v_steps_to_subtract THEN
            p_success := 0;
            p_message := 'Недостаточно шагов для движения';
            RETURN;
        END IF;
        
        -- Вычисляем новое количество шагов с округлением до 1 десятичного знака
        v_new_remaining_steps := ROUND(v_remaining_steps - v_steps_to_subtract, 1);
        
        -- Обновляем положение героя и количество оставшихся шагов
        UPDATE game_states
        SET hero_x = p_new_x,
            hero_y = p_new_y,
            remaining_steps = v_new_remaining_steps
        WHERE user_id = p_user_id;
        
        p_success := 1;
        p_message := 'Успешное перемещение';
        p_current_day := v_current_day;
        p_remaining_steps := v_new_remaining_steps;
        p_new_day := 0;
        
        -- Убираем автоматический переход на новый день при окончании шагов
        -- День будет изменяться только по явному запросу пользователя
        
        COMMIT;
        
        DBMS_OUTPUT.PUT_LINE('Успешное перемещение на координаты: ' || p_new_x || ', ' || p_new_y);
        DBMS_OUTPUT.PUT_LINE('Осталось шагов: ' || p_remaining_steps);
    EXCEPTION
        WHEN OTHERS THEN
            p_success := 0;
            p_message := 'Ошибка при перемещении: ' || SQLERRM;
            ROLLBACK;
    END move_hero;

    -- Начало нового дня
    PROCEDURE start_new_day(
        p_user_id IN NUMBER,
        p_success OUT NUMBER
    ) IS
    BEGIN
        -- Инициализируем p_success как неудачу
        p_success := 0;
        
        -- Обновляем состояние игры
        UPDATE game_states
        SET current_day = current_day + 1,
            remaining_steps = 20,
            last_updated = CURRENT_TIMESTAMP
        WHERE user_id = p_user_id;
        
        -- Если обновление прошло успешно
        IF SQL%ROWCOUNT > 0 THEN
            p_success := 1;
            COMMIT;
            DBMS_OUTPUT.PUT_LINE('Успешно начат новый день для пользователя ' || p_user_id);
        ELSE
            DBMS_OUTPUT.PUT_LINE('Ошибка: пользователь не найден');
        END IF;
    EXCEPTION
        WHEN OTHERS THEN
            DBMS_OUTPUT.PUT_LINE('Ошибка при начале нового дня: ' || SQLERRM);
            p_success := 0;
            ROLLBACK;
    END start_new_day;

    -- Новые функции для работы со зданиями
    
    -- Получение информации о здании
    PROCEDURE get_building_info(
        p_x IN NUMBER,
        p_y IN NUMBER,
        p_user_id IN NUMBER,
        p_building_type OUT VARCHAR2,
        p_owner_id OUT NUMBER,
        p_production_rate OUT NUMBER,
        p_is_near OUT NUMBER
    ) IS
        v_map_data CLOB;
        v_map_lines DBMS_SQL.VARCHAR2A;
        v_current_tile CHAR(1);
        v_hero_x NUMBER;
        v_hero_y NUMBER;
    BEGIN
        -- Получаем карту и позицию героя
        SELECT map_data, hero_x, hero_y
        INTO v_map_data, v_hero_x, v_hero_y
        FROM game_states
        WHERE user_id = p_user_id;
        
        -- Проверяем, находится ли герой рядом со зданием
        IF ABS(v_hero_x - p_x) <= 1 AND ABS(v_hero_y - p_y) <= 1 THEN
            p_is_near := 1;
        ELSE
            p_is_near := 0;
        END IF;
        
        -- Получаем тип здания из карты
        v_current_tile := SUBSTR(
            REGEXP_SUBSTR(v_map_data, '[^\n]*', 1, p_y),
            p_x,
            1
        );
        
        -- Определяем тип здания и его базовую производительность
        CASE v_current_tile
            WHEN 'S' THEN 
                p_building_type := 'SAWMILL';
                p_production_rate := 10; -- Базовая производительность лесопилки
            WHEN 'M' THEN 
                p_building_type := 'MINE';
                p_production_rate := 100; -- Меняем с 8 на 100
            ELSE
                p_building_type := NULL;
                p_production_rate := 0;
        END CASE;
        
        -- Получаем информацию о владельце здания
        BEGIN
            SELECT owner_id
            INTO p_owner_id
            FROM buildings
            WHERE x_coord = p_x AND y_coord = p_y;
        EXCEPTION
            WHEN NO_DATA_FOUND THEN
                p_owner_id := NULL;
        END;
        
    EXCEPTION
        WHEN OTHERS THEN
            p_building_type := NULL;
            p_owner_id := NULL;
            p_production_rate := 0;
            p_is_near := 0;
    END get_building_info;
    
    -- Захват здания
    PROCEDURE capture_building(
        p_user_id IN NUMBER,
        p_x IN NUMBER,
        p_y IN NUMBER,
        p_building_type IN VARCHAR2,
        p_success OUT NUMBER,
        p_message OUT VARCHAR2
    ) IS
        v_building_exists NUMBER;
        v_db_building_type VARCHAR2(20);
        v_production_rate NUMBER;
        v_ore_production NUMBER;
        v_gold_production NUMBER;
        v_map_data CLOB;
        v_current_tile CHAR(1);
        v_map_tile_type CHAR(1);
    BEGIN
        -- Получаем тип клетки из карты
        SELECT map_data
        INTO v_map_data
        FROM game_states
        WHERE user_id = p_user_id;
        
        v_current_tile := SUBSTR(
            REGEXP_SUBSTR(v_map_data, '[^\n]*', 1, p_y + 1),
            p_x + 1,
            1
        );
        
        -- Определяем тип здания из карты
        CASE v_current_tile
            WHEN 'S' THEN 
                v_map_tile_type := 'S';
                v_db_building_type := 'SAWMILL';
                v_production_rate := c_base_wood_production;  -- 80 дерева
                v_ore_production := 0;
                v_gold_production := 0;
            WHEN 'M' THEN 
                v_map_tile_type := 'M';
                v_db_building_type := 'MINE';
                v_production_rate := 0;
                v_ore_production := c_base_ore_production;    -- 60 руды
                v_gold_production := c_base_gold_production;  -- 40 золота
            ELSE
                -- Если передан тип здания напрямую
                v_db_building_type := p_building_type;
                
                -- Устанавливаем скорость производства в зависимости от типа
                IF p_building_type = 'SAWMILL' THEN
                    v_production_rate := c_base_wood_production;  -- 80 дерева
                    v_ore_production := 0;
                    v_gold_production := 0;
                ELSIF p_building_type = 'MINE' THEN
                    v_production_rate := 0;
                    v_ore_production := c_base_ore_production;    -- 60 руды
                    v_gold_production := c_base_gold_production;  -- 40 золота
                ELSE
                    p_success := 0;
                    p_message := 'Неверный тип здания';
                    RETURN;
                END IF;
        END CASE;
        
        -- Проверяем, существует ли уже запись о здании
        SELECT COUNT(*)
        INTO v_building_exists
        FROM buildings
        WHERE x_coord = p_x AND y_coord = p_y;

        IF v_building_exists > 0 THEN
            -- Обновляем существующее здание
            UPDATE buildings
            SET owner_id = p_user_id,
                building_type = v_db_building_type,
                production_rate = v_production_rate,
                ore_production = v_ore_production,
                gold_production = v_gold_production,
                last_collected = SYSTIMESTAMP
            WHERE x_coord = p_x AND y_coord = p_y;
        ELSE
            -- Создаем новое здание
            INSERT INTO buildings (
                building_type, x_coord, y_coord, owner_id,
                production_rate, ore_production, gold_production, last_collected
            ) VALUES (
                v_db_building_type, p_x, p_y, p_user_id,
                v_production_rate, v_ore_production, v_gold_production, SYSTIMESTAMP
            );
        END IF;

        p_success := 1;
        p_message := 'Здание успешно захвачено';
        COMMIT;
    EXCEPTION
        WHEN OTHERS THEN
            p_success := 0;
            p_message := 'Ошибка при захвате здания: ' || SQLERRM;
            ROLLBACK;
    END capture_building;

    -- Захват замка
    PROCEDURE capture_castle(
        p_user_id IN NUMBER,
        p_x IN NUMBER,
        p_y IN NUMBER,
        p_success OUT NUMBER,
        p_message OUT VARCHAR2
    ) IS
        v_castle_exists NUMBER;
        v_any_castle_exists NUMBER;
    BEGIN
        -- Сначала проверяем, есть ли вообще замок на этих координатах
        SELECT COUNT(*)
        INTO v_any_castle_exists
        FROM buildings
        WHERE building_type = 'CASTLE'
        AND x_coord = p_x
        AND y_coord = p_y;
        
        -- Проверяем существование замка для данного пользователя
        SELECT COUNT(*)
        INTO v_castle_exists
        FROM buildings
        WHERE building_type = 'CASTLE'
        AND x_coord = p_x
        AND y_coord = p_y
        AND owner_id = p_user_id;
        
        IF v_castle_exists = 0 THEN
            IF v_any_castle_exists > 0 THEN
                -- Если замок существует, но принадлежит другому игроку или свободен - обновляем owner_id
                UPDATE buildings
                SET owner_id = p_user_id,
                    last_collected = CURRENT_TIMESTAMP
                WHERE building_type = 'CASTLE'
                AND x_coord = p_x
                AND y_coord = p_y;
                
                p_success := 1;
                p_message := 'Замок успешно захвачен';
            ELSE
                -- Если замка нет вообще, создаем его
                INSERT INTO buildings (
                    building_type,
                    x_coord,
                    y_coord,
                    owner_id,
                    production_rate,
                    last_collected
                ) VALUES (
                    'CASTLE',
                    p_x,
                    p_y,
                    p_user_id,
                    1000, -- Базовая добыча золота в день
                    CURRENT_TIMESTAMP
                );
                
                p_success := 1;
                p_message := 'Замок успешно захвачен';
            END IF;
        ELSE
            -- Если замок уже существует для этого пользователя
            p_success := 0;
            p_message := 'Этот замок уже принадлежит вам';
        END IF;
        
        COMMIT;
    EXCEPTION
        WHEN OTHERS THEN
            p_success := 0;
            p_message := 'Ошибка при захвате замка: ' || SQLERRM;
            ROLLBACK;
    END capture_castle;
    
    -- Отзыв владения замком
    PROCEDURE relinquish_castle(
        p_user_id IN NUMBER,
        p_x IN NUMBER,
        p_y IN NUMBER,
        p_success OUT NUMBER,
        p_message OUT VARCHAR2
    ) IS
        v_rows_deleted NUMBER;
    BEGIN
        -- Удаляем замок для данного пользователя
        DELETE FROM buildings
        WHERE building_type = 'CASTLE'
        AND x_coord = p_x
        AND y_coord = p_y
        AND owner_id = p_user_id;
        
        v_rows_deleted := SQL%ROWCOUNT;
        
        IF v_rows_deleted > 0 THEN
            p_success := 1;
            p_message := 'Владение замком успешно отозвано';
        ELSE
            p_success := 0;
            p_message := 'Этот замок не принадлежит вам';
        END IF;
        
        COMMIT;
    EXCEPTION
        WHEN OTHERS THEN
            p_success := 0;
            p_message := 'Ошибка при отзыве владения замком: ' || SQLERRM;
            ROLLBACK;
    END relinquish_castle;
    
    -- Получение информации о замке
    PROCEDURE get_castle_info(
        p_x IN NUMBER,
        p_y IN NUMBER,
        p_user_id IN NUMBER,
        p_owner_id OUT NUMBER,
        p_production_rate OUT NUMBER
    ) IS
        v_debug_count NUMBER;
    BEGIN
        -- Отладочная информация: проверяем, есть ли вообще замки в базе
        SELECT COUNT(*) INTO v_debug_count
        FROM buildings
        WHERE building_type = 'CASTLE';
        
        DBMS_OUTPUT.PUT_LINE('DEBUG: Всего замков в базе: ' || v_debug_count);
        
        -- Отладочная информация: проверяем, есть ли замок на этих координатах
        SELECT COUNT(*) INTO v_debug_count
        FROM buildings
        WHERE building_type = 'CASTLE'
        AND x_coord = p_x
        AND y_coord = p_y;
        
        DBMS_OUTPUT.PUT_LINE('DEBUG: Замков на координатах (' || p_x || ',' || p_y || '): ' || v_debug_count);
        
        -- Получаем информацию о замке по координатам (НЕ фильтруем по владельцу)
        BEGIN
            SELECT owner_id, production_rate
            INTO p_owner_id, p_production_rate
            FROM buildings
            WHERE building_type = 'CASTLE'
            AND x_coord = p_x
            AND y_coord = p_y;
            
            DBMS_OUTPUT.PUT_LINE('DEBUG: Найден замок с owner_id=' || p_owner_id || ', production_rate=' || p_production_rate);
        EXCEPTION
            WHEN NO_DATA_FOUND THEN
                p_owner_id := NULL;
                p_production_rate := 1000; -- Базовая производительность незахваченного замка
                DBMS_OUTPUT.PUT_LINE('DEBUG: Замок не найден, устанавливаем owner_id=NULL');
        END;
    EXCEPTION
        WHEN OTHERS THEN
            p_owner_id := NULL;
            p_production_rate := 0;
            DBMS_OUTPUT.PUT_LINE('DEBUG: Ошибка в get_castle_info: ' || SQLERRM);
    END get_castle_info;

    -- Функции для работы с ресурсами
    PROCEDURE add_resources_from_buildings(p_user_id IN NUMBER) IS
        v_wood NUMBER := 0;
        v_ore NUMBER := 0;
        v_gold NUMBER := 0;
        v_exists NUMBER;
    BEGIN
        -- Собираем ресурсы с лесопилок
        FOR sawmill IN (SELECT production_rate FROM buildings 
                       WHERE owner_id = p_user_id AND building_type = 'SAWMILL') LOOP
            v_wood := v_wood + sawmill.production_rate;
        END LOOP;
        
        -- Собираем ресурсы с шахт
        FOR mine IN (SELECT ore_production, gold_production FROM buildings 
                    WHERE owner_id = p_user_id AND building_type = 'MINE') LOOP
            v_ore := v_ore + mine.ore_production;
            v_gold := v_gold + mine.gold_production;
        END LOOP;
        
        -- Проверяем существование записи
        SELECT COUNT(*) INTO v_exists
        FROM user_resources
        WHERE user_id = p_user_id;
        
        -- Обновляем или вставляем ресурсы
        IF v_exists > 0 THEN
            UPDATE user_resources
            SET wood = wood + v_wood,
                ore = ore + v_ore,
                gold = gold + v_gold,
                last_collected = SYSTIMESTAMP
            WHERE user_id = p_user_id;
        ELSE
            INSERT INTO user_resources (user_id, wood, ore, gold, last_collected)
            VALUES (p_user_id, v_wood, v_ore, v_gold, SYSTIMESTAMP);
        END IF;
            
        COMMIT;
    EXCEPTION
        WHEN OTHERS THEN
            ROLLBACK;
            RAISE;
    END add_resources_from_buildings;
    
    PROCEDURE get_user_resources(p_user_id IN NUMBER, p_wood OUT NUMBER, p_ore OUT NUMBER, p_gold OUT NUMBER) IS
    BEGIN
        SELECT wood, ore, gold
        INTO p_wood, p_ore, p_gold
        FROM user_resources
        WHERE user_id = p_user_id;
    EXCEPTION
        WHEN NO_DATA_FOUND THEN
            p_wood := 0;
            p_ore := 0;
            p_gold := 0;
    END get_user_resources;
    
    PROCEDURE update_user_resources(p_user_id IN NUMBER, p_wood IN NUMBER, p_ore IN NUMBER, p_gold IN NUMBER) IS
    BEGIN
        MERGE INTO user_resources ur
        USING (SELECT p_user_id as user_id FROM dual) d
        ON (ur.user_id = d.user_id)
        WHEN MATCHED THEN
            UPDATE SET 
                wood = p_wood,
                ore = p_ore,
                gold = p_gold,
                last_collected = SYSTIMESTAMP
        WHEN NOT MATCHED THEN
            INSERT (user_id, wood, ore, gold, last_collected)
            VALUES (p_user_id, p_wood, p_ore, p_gold, SYSTIMESTAMP);
            
        COMMIT;
    END update_user_resources;

    PROCEDURE cheat_add_resources(
        p_user_id IN NUMBER,
        p_wood IN NUMBER,
        p_ore IN NUMBER,
        p_gold IN NUMBER
    ) IS
        v_exists NUMBER;
    BEGIN
        SELECT COUNT(*) INTO v_exists FROM user_resources WHERE user_id = p_user_id;
        IF v_exists > 0 THEN
            UPDATE user_resources
            SET wood = wood + p_wood,
                ore = ore + p_ore,
                gold = gold + p_gold,
                last_collected = SYSTIMESTAMP
            WHERE user_id = p_user_id;
        ELSE
            INSERT INTO user_resources (user_id, wood, ore, gold, last_collected)
            VALUES (p_user_id, p_wood, p_ore, p_gold, SYSTIMESTAMP);
        END IF;
        COMMIT;
    EXCEPTION
        WHEN OTHERS THEN
            ROLLBACK;
            RAISE;
    END cheat_add_resources;

    -- Добавляем процедуру для улучшения здания
    PROCEDURE upgrade_building(
        p_user_id IN NUMBER,
        p_x IN NUMBER,
        p_y IN NUMBER,
        p_building_type IN VARCHAR2,
        p_result OUT NUMBER,
        p_message OUT VARCHAR2
    ) IS
        v_current_level NUMBER;
        v_owner_id NUMBER;
        v_wood NUMBER;
        v_ore NUMBER;
        v_gold NUMBER;
        v_upgrade_wood NUMBER;
        v_upgrade_ore NUMBER;
        v_upgrade_gold NUMBER;
        v_current_production NUMBER;
    BEGIN
        -- Получаем текущий уровень и владельца здания
        SELECT "level", owner_id INTO v_current_level, v_owner_id
        FROM buildings
        WHERE x_coord = p_x AND y_coord = p_y AND building_type = p_building_type;

        -- Проверяем владение
        IF v_owner_id != p_user_id THEN
            p_result := 0;
            p_message := 'Вы не владеете этим зданием';
            RETURN;
        END IF;

        -- Проверяем максимальный уровень
        IF v_current_level >= 10 THEN
            p_result := 0;
            p_message := 'Достигнут максимальный уровень';
            RETURN;
        END IF;

        -- Получаем текущие ресурсы игрока
        SELECT wood, ore, gold INTO v_wood, v_ore, v_gold
        FROM user_resources
        WHERE user_id = p_user_id;

        -- Рассчитываем текущее производство и стоимость улучшения
        CASE p_building_type
            WHEN 'SAWMILL' THEN
                v_current_production := FLOOR(c_base_wood_production * POWER(1.5, v_current_level - 1));
                -- Стоимость улучшения (45% дерева, 35% руды, 20% золота от текущей добычи)
                v_upgrade_wood := FLOOR(v_current_production * 0.45);
                v_upgrade_ore := FLOOR(v_current_production * 0.35);
                v_upgrade_gold := FLOOR(v_current_production * 0.20);
            WHEN 'MINE' THEN
                v_current_production := FLOOR(c_base_ore_production * POWER(1.5, v_current_level - 1));
                -- Стоимость улучшения (45% дерева, 35% руды, 20% золота от текущей добычи)
                v_upgrade_wood := FLOOR(v_current_production * 0.45);
                v_upgrade_ore := FLOOR(v_current_production * 0.35);
                v_upgrade_gold := FLOOR(v_current_production * 0.20);
        END CASE;

        -- Проверяем достаточно ли ресурсов
        IF v_wood < v_upgrade_wood OR v_ore < v_upgrade_ore OR v_gold < v_upgrade_gold THEN
            p_result := 0;
            p_message := 'Недостаточно ресурсов для улучшения';
            RETURN;
        END IF;

        -- Вычитаем ресурсы
        UPDATE user_resources
        SET wood = wood - v_upgrade_wood,
            ore = ore - v_upgrade_ore,
            gold = gold - v_upgrade_gold
        WHERE user_id = p_user_id;

        -- Улучшаем здание и обновляем производство
        UPDATE buildings
        SET "level" = "level" + 1,
            production_rate = CASE 
                WHEN building_type = 'SAWMILL' THEN FLOOR(c_base_wood_production * POWER(1.5, v_current_level))
                ELSE production_rate
            END,
            ore_production = CASE 
                WHEN building_type = 'MINE' THEN FLOOR(c_base_ore_production * POWER(1.5, v_current_level))
                ELSE ore_production
            END,
            gold_production = CASE 
                WHEN building_type = 'MINE' THEN FLOOR(c_base_gold_production * POWER(1.5, v_current_level))
                ELSE gold_production
            END
        WHERE x_coord = p_x AND y_coord = p_y AND building_type = p_building_type;

        COMMIT;
        p_result := 1;
        p_message := 'Здание успешно улучшено';

    EXCEPTION
        WHEN NO_DATA_FOUND THEN
            p_result := 0;
            p_message := 'Здание не найдено';
        WHEN OTHERS THEN
            ROLLBACK;
            p_result := 0;
            p_message := 'Ошибка при улучшении здания: ' || SQLERRM;
    END upgrade_building;

    -- === Армия ===
    PROCEDURE hire_army(
        p_user_id IN NUMBER,
        p_unit_type IN VARCHAR2,
        p_count IN NUMBER,
        p_x IN NUMBER,
        p_y IN NUMBER,
        p_result OUT NUMBER,
        p_message OUT VARCHAR2
    ) IS
        v_attack NUMBER;
        v_defense NUMBER;
        v_health NUMBER;
        v_wood_cost NUMBER;
        v_ore_cost NUMBER;
        v_gold_cost NUMBER;
        v_user_wood NUMBER;
        v_user_ore NUMBER;
        v_user_gold NUMBER;
    BEGIN
        CASE p_unit_type
            WHEN 'SWORDSMAN' THEN
                v_attack := 10; v_defense := 5; v_health := 100;
                v_wood_cost := 5 * p_count; v_ore_cost := 2 * p_count; v_gold_cost := 10 * p_count;
            WHEN 'ARCHER' THEN
                v_attack := 8; v_defense := 3; v_health := 70;
                v_wood_cost := 7 * p_count; v_ore_cost := 1 * p_count; v_gold_cost := 12 * p_count;
            WHEN 'TANK' THEN
                v_attack := 5; v_defense := 10; v_health := 200;
                v_wood_cost := 10 * p_count; v_ore_cost := 8 * p_count; v_gold_cost := 20 * p_count;
            ELSE
                p_result := 0; p_message := 'Неизвестный тип юнита'; RETURN;
        END CASE;
        SELECT wood, ore, gold INTO v_user_wood, v_user_ore, v_user_gold FROM user_resources WHERE user_id = p_user_id;
        IF v_user_wood < v_wood_cost OR v_user_ore < v_ore_cost OR v_user_gold < v_gold_cost THEN
            p_result := 0; p_message := 'Недостаточно ресурсов'; RETURN;
        END IF;
        UPDATE user_resources SET wood = wood - v_wood_cost, ore = ore - v_ore_cost, gold = gold - v_gold_cost WHERE user_id = p_user_id;
        INSERT INTO army_units (user_id, unit_type, count, x_coord, y_coord, health, attack, defense)
        VALUES (p_user_id, p_unit_type, p_count, p_x, p_y, v_health, v_attack, v_defense);
        COMMIT;
        p_result := 1; p_message := 'Армия нанята';
    EXCEPTION
        WHEN OTHERS THEN
            ROLLBACK;
            p_result := 0; p_message := 'Найм армии невозможен. Вам не хватает ресурсов.';
    END;

    PROCEDURE get_user_army(
        p_user_id IN NUMBER,
        p_units OUT SYS_REFCURSOR
    ) IS
    BEGIN
        OPEN p_units FOR
            SELECT unit_id, unit_type, count, x_coord, y_coord, health, attack, defense
            FROM army_units WHERE user_id = p_user_id;
    END;

    PROCEDURE move_army(
        p_user_id IN NUMBER,
        p_unit_id IN NUMBER,
        p_new_x IN NUMBER,
        p_new_y IN NUMBER,
        p_result OUT NUMBER,
        p_message OUT VARCHAR2
    ) IS
        v_owner NUMBER;
    BEGIN
        SELECT user_id INTO v_owner FROM army_units WHERE unit_id = p_unit_id;
        IF v_owner != p_user_id THEN
            p_result := 0; p_message := 'Вы не владеете этим отрядом'; RETURN;
        END IF;
        UPDATE army_units SET x_coord = p_new_x, y_coord = p_new_y WHERE unit_id = p_unit_id;
        COMMIT;
        p_result := 1; p_message := 'Отряд перемещён';
    EXCEPTION
        WHEN OTHERS THEN
            ROLLBACK;
            p_result := 0; p_message := 'Ошибка при перемещении: ' || SQLERRM;
    END;

    PROCEDURE get_unit_types(
        p_types OUT SYS_REFCURSOR
    ) IS
    BEGIN
        OPEN p_types FOR
            SELECT 'SWORDSMAN' AS unit_type, 10 AS attack, 5 AS defense, 100 AS health, 5 AS wood_cost, 2 AS ore_cost, 10 AS gold_cost FROM dual UNION ALL
            SELECT 'ARCHER', 8, 3, 70, 7, 1, 12 FROM dual UNION ALL
            SELECT 'TANK', 5, 10, 200, 10, 8, 20 FROM dual;
    END;
END game_logic_pkg;
