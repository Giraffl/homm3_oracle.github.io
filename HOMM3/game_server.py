import http.server
import socketserver
import json
import oracledb
import urllib.parse
from urllib.parse import parse_qs
import os
from dotenv import load_dotenv

# Инициализация клиента Oracle в толстом режиме
try:
    oracledb.init_oracle_client()
    print("Oracle клиент успешно инициализирован в толстом режиме")
except Exception as e:
    print(f"Ошибка при инициализации Oracle клиента: {e}")
    print("Переключаемся на тонкий режим")

# Настройки подключения к Oracle
load_dotenv()  # Загружаем переменные окружения из .env файла

DB_CONFIG = {
    'user': os.environ['DB_USER'],
    'password': os.environ['DB_PASSWORD'],
    'host': os.environ['DB_HOST'],
    'port': os.environ['DB_PORT'],
    'service': os.environ['DB_SERVICE']
}


class GameServer:
    def __init__(self):
        # Подключение к базе данных
        try:
            # Используем толстый режим для подключения
            self.connection = oracledb.connect(
                user=DB_CONFIG['user'],
                password=DB_CONFIG['password'],
                host=DB_CONFIG['host'],
                port=DB_CONFIG['port'],
                service_name=DB_CONFIG['service']
            )
            print("Успешное подключение к базе данных в толстом режиме")
        except Exception as e:
            print(f"Ошибка при подключении к базе данных: {e}")
            print("Используем тестовую реализацию без подключения к базе данных")
            self.connection = None
            self.cursor = None
            return
            
        self.cursor = self.connection.cursor()
        
        # Оптимизация производительности
        self.connection.autocommit = True
        
        # Установка параметров производительности
        try:
            self.cursor.execute("""
            BEGIN
                EXECUTE IMMEDIATE 'ALTER SESSION SET OPTIMIZER_MODE = ALL_ROWS';
                EXECUTE IMMEDIATE 'ALTER SESSION SET CURSOR_SHARING = FORCE';
            END;
            """)
        except Exception as e:
            print(f"Ошибка при установке параметров производительности: {e}")
    
    def authenticate_player(self, username, password):
        try:
            result = self.cursor.callfunc(
                "game_logic_pkg.authenticate_user",
                oracledb.NUMBER,
                [username, password]
            )
            
            if result > 0:
                print(f"[ПОЛЬЗОВАТЕЛЬ] {username} успешно вошел в систему (ID: {result})")
            elif result == -1:
                print(f"[ПОЛЬЗОВАТЕЛЬ] Неудачная попытка входа для {username}")
            else:
                print(f"[ПОЛЬЗОВАТЕЛЬ] {username} уже авторизован в системе")
            
            return result
        except Exception as error:
            print(f"[ОШИБКА] Ошибка при аутентификации: {error}")
            return -2
    
    def register_player(self, username, password):
        try:
            result = self.cursor.callfunc(
                "game_logic_pkg.register_user",
                oracledb.NUMBER,
                [username, password]
            )
            
            if result > 0:
                print(f"[ПОЛЬЗОВАТЕЛЬ] Зарегистрирован новый игрок: {username} (ID: {result})")
            else:
                print(f"[ПОЛЬЗОВАТЕЛЬ] Попытка регистрации существующего пользователя: {username}")
            
            return result
        except Exception as error:
            print(f"[ОШИБКА] Ошибка при регистрации: {error}")
            return -2
    
    def get_game_state(self, user_id):
        try:
            # Определение переменных OUT
            map_data = self.cursor.var(oracledb.CLOB)
            hero_x = self.cursor.var(oracledb.NUMBER)
            hero_y = self.cursor.var(oracledb.NUMBER)
            castle_x = self.cursor.var(oracledb.NUMBER)
            castle_y = self.cursor.var(oracledb.NUMBER)
            current_day = self.cursor.var(oracledb.NUMBER)
            remaining_steps = self.cursor.var(oracledb.NUMBER)
            
            # Вызов процедуры
            self.cursor.callproc(
                "game_logic_pkg.get_game_state",
                [user_id, map_data, hero_x, hero_y, castle_x, castle_y, current_day, remaining_steps]
            )
            
            # Преобразуем CLOB в строку
            map_data_value = map_data.getvalue()
            if map_data_value:
                map_data_value = str(map_data_value.read())
            
            return {
                'mapData': map_data_value,
                'heroX': hero_x.getvalue(),
                'heroY': hero_y.getvalue(),
                'castleX': castle_x.getvalue(),
                'castleY': castle_y.getvalue(),
                'currentDay': current_day.getvalue(),
                'remainingSteps': remaining_steps.getvalue()
            }
        except Exception as error:
            print(f"[ОШИБКА] Ошибка при получении состояния игры: {error}")
            return None
    
    def move_hero(self, user_id, new_x, new_y):
        try:
            # Определение переменных OUT
            success = self.cursor.var(oracledb.NUMBER)
            message = self.cursor.var(oracledb.STRING)
            current_day = self.cursor.var(oracledb.NUMBER)
            remaining_steps = self.cursor.var(oracledb.NUMBER)
            new_day = self.cursor.var(oracledb.NUMBER)
            
            # Вызов процедуры
            self.cursor.callproc(
                "game_logic_pkg.move_hero",
                [user_id, new_x, new_y, success, message, current_day, remaining_steps, new_day]
            )
            
            # Получаем результаты
            success_value = success.getvalue()
            message_value = message.getvalue()
            
            # Если перемещение успешно, возвращаем обновленное состояние
            if success_value == 1:
                return {
                    'success': True,
                    'message': message_value,
                    'state': {
                        'currentDay': current_day.getvalue(),
                        'remainingSteps': remaining_steps.getvalue(),
                        'newDay': new_day.getvalue() == 1,
                        'heroX': new_x,
                        'heroY': new_y
                    }
                }
            else:
                return {
                    'success': False,
                    'message': message_value or 'Невозможно переместиться в указанную точку'
                }
        except Exception as error:
            print(f"[ОШИБКА] Ошибка при перемещении героя: {error}")
            return {'success': False, 'message': str(error)}
    
    def get_previous_game_state(self, user_id):
        try:
            # Определение переменных OUT
            map_data = self.cursor.var(oracledb.CLOB)
            hero_x = self.cursor.var(oracledb.NUMBER)
            hero_y = self.cursor.var(oracledb.NUMBER)
            castle_x = self.cursor.var(oracledb.NUMBER)
            castle_y = self.cursor.var(oracledb.NUMBER)
            current_day = self.cursor.var(oracledb.NUMBER)
            remaining_steps = self.cursor.var(oracledb.NUMBER)
            
            # Вызов процедуры
            self.cursor.callproc(
                "game_logic_pkg.get_game_state",
                [user_id, map_data, hero_x, hero_y, castle_x, castle_y, current_day, remaining_steps]
            )
            
            # Преобразуем CLOB в строку
            map_data_value = map_data.getvalue()
            if map_data_value:
                map_data_value = str(map_data_value.read())
            
            return {
                'mapData': map_data_value,
                'heroX': hero_x.getvalue(),
                'heroY': hero_y.getvalue(),
                'castleX': castle_x.getvalue(),
                'castleY': castle_y.getvalue(),
                'currentDay': current_day.getvalue(),
                'remainingSteps': remaining_steps.getvalue()
            }
        except Exception as error:
            print(f"[ОШИБКА] Ошибка при получении предыдущего состояния игры: {error}")
            return None
    
    def check_castle_interaction(self, user_id, hero_x, hero_y):
        try:
            with self.connection.cursor() as cursor:
                # Вызываем функцию
                result = cursor.callfunc("game_logic_pkg.check_castle_interaction", 
                                        int, [user_id, hero_x, hero_y])
                return result
        except Exception as e:
            print(f"Error checking castle interaction: {e}")
            return 0
    
    def start_new_day(self, user_id):
        try:
            # Определение переменной OUT для успешности операции
            success = self.cursor.var(oracledb.NUMBER)
            
            # Вызов процедуры
            self.cursor.callproc(
                "game_logic_pkg.start_new_day",
                [user_id, success]
            )
            
            return success.getvalue() == 1
        except Exception as error:
            print(f"[ОШИБКА] Ошибка при начале нового дня: {error}")
            return False
    
    def save_explored_tiles(self, user_id, explored_tiles_json):
        """Сохраняет исследованные тайлы для пользователя в базе данных"""
        try:
            # Проверяем, существует ли запись для этого пользователя
            self.cursor.execute(
                "SELECT COUNT(*) FROM explored_tiles WHERE user_id = :user_id",
                {"user_id": user_id}
            )
            count = self.cursor.fetchone()[0]
            
            if count > 0:
                # Обновляем существующую запись
                self.cursor.execute(
                    "UPDATE explored_tiles SET tiles_data = :tiles_data, updated_at = CURRENT_TIMESTAMP WHERE user_id = :user_id",
                    {"tiles_data": explored_tiles_json, "user_id": user_id}
                )
            else:
                # Создаем новую запись
                self.cursor.execute(
                    "INSERT INTO explored_tiles (user_id, tiles_data, created_at, updated_at) VALUES (:user_id, :tiles_data, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
                    {"user_id": user_id, "tiles_data": explored_tiles_json}
                )
                
            self.connection.commit()
            return True
        except Exception as error:
            print(f"[ОШИБКА] Ошибка при сохранении исследованных тайлов: {error}")
            return False
            
    def get_explored_tiles(self, user_id):
        """Получает исследованные тайлы пользователя из базы данных"""
        try:
            self.cursor.execute(
                "SELECT tiles_data FROM explored_tiles WHERE user_id = :user_id",
                {"user_id": user_id}
            )
            result = self.cursor.fetchone()
            
            if result:
                # Преобразуем CLOB в строку
                tiles_data = result[0]
                if hasattr(tiles_data, 'read'):
                    # Если это LOB объект, читаем его как строку
                    return tiles_data.read()
                return tiles_data
            return "{}"  # Пустой объект JSON, если нет данных
        except Exception as error:
            print(f"[ОШИБКА] Ошибка при получении исследованных тайлов: {error}")
            return "{}"
    
    def get_castle_info(self, x, y, user_id=None):
        try:
            with self.connection.cursor() as cursor:
                # Объявляем OUT-параметры
                owner_id_var = cursor.var(int)
                production_rate_var = cursor.var(int)
                
                # Вызываем процедуру с ID пользователя
                cursor.callproc("game_logic_pkg.get_castle_info",
                               [x, y, user_id, owner_id_var, production_rate_var])
                
                # Получаем значения OUT-параметров
                owner_id = owner_id_var.getvalue()
                production_rate = production_rate_var.getvalue()
                
                return owner_id, production_rate
        except Exception as e:
            print(f"Ошибка при получении информации о замке: {e}")
            return None, 0

    def capture_building(self, user_id, x, y, building_type):
        try:
            print(f"[DEBUG] Начинаем захват здания. Тип: {building_type}, Координаты: {x}, {y}, Пользователь: {user_id}")
            
            # Получаем имя пользователя
            username = None
            try:
                with self.connection.cursor() as cursor:
                    cursor.execute("SELECT username FROM game_users WHERE user_id = :user_id", user_id=user_id)
                    result = cursor.fetchone()
                    if result:
                        username = result[0]
                        print(f"[DEBUG] Найден пользователь: {username}")
                    else:
                        print(f"[DEBUG] Пользователь не найден с ID: {user_id}")
            except Exception as e:
                print(f"[DEBUG] Ошибка при получении имени пользователя: {e}")
            
            with self.connection.cursor() as cursor:
                # Объявляем OUT-параметры
                result_var = cursor.var(int)
                message_var = cursor.var(str)
                
                # Вызываем процедуру
                print(f"[DEBUG] Вызываем процедуру capture_building с параметрами: {user_id}, {x}, {y}, {building_type}")
                cursor.callproc("game_logic_pkg.capture_building", 
                               [user_id, x, y, building_type, result_var, message_var])
                
                # Получаем значения OUT-параметров
                result = result_var.getvalue()
                message = message_var.getvalue()
                
                print(f"[DEBUG] Результат вызова: {result}, Сообщение: {message}")
                
                self.connection.commit()
                print(f"[DEBUG] Транзакция завершена")
                
                return {"success": result == 1, "message": message, "username": username}
        except Exception as e:
            print(f"[ERROR] Ошибка при захвате здания: {e}")
            return {"success": False, "message": str(e)}
            
    def get_user_buildings(self, user_id):
        try:
            with self.connection.cursor() as cursor:
                # Сначала получаем имя пользователя
                cursor.execute("""
                    SELECT username
                    FROM game_users
                    WHERE user_id = :user_id
                """, user_id=user_id)
                
                result = cursor.fetchone()
                username = result[0] if result else f"User_{user_id}"
                
                # Получаем все здания, принадлежащие пользователю
                cursor.execute("""
                    SELECT building_type, x_coord, y_coord, "level", production_rate, ore_production, gold_production
                    FROM buildings
                    WHERE owner_id = :user_id
                """, user_id=user_id)
                
                buildings = {
                    "sawmills": [],
                    "mines": []
                }
                
                for row in cursor.fetchall():
                    building_type, x, y, level, production, ore_production, gold_production = row
                    if building_type == 'SAWMILL':
                        buildings["sawmills"].append({
                            "x": x,
                            "y": y,
                            "level": level,
                            "production": production,
                            "owner": username
                        })
                    elif building_type == 'MINE':
                        buildings["mines"].append({
                            "x": x,
                            "y": y,
                            "level": level,
                            "oreProduction": ore_production,
                            "goldProduction": gold_production,
                            "owner": username
                        })
                
                return {"success": True, "buildings": buildings}
        except Exception as e:
            print(f"Error getting user buildings: {e}")
            return {"success": False, "message": str(e)}
    
    def relinquish_building(self, user_id, x, y, building_type):
        try:
            print(f"[DEBUG] Начинаем отзыв владения зданием. Тип: {building_type}, Координаты: {x}, {y}, Пользователь: {user_id}")
            with self.connection.cursor() as cursor:
                # Проверяем владение и отзываем владение зданием
                # Используем простой UPDATE без RETURNING, который не поддерживается в Oracle
                cursor.execute("""
                    UPDATE buildings
                    SET owner_id = NULL, last_collected = NULL
                    WHERE x_coord = :x AND y_coord = :y 
                    AND building_type = :building_type
                    AND owner_id = :user_id
                """, x=x, y=y, building_type=building_type, user_id=user_id)
                
                # Проверяем, сколько строк было обновлено
                rows_updated = cursor.rowcount
                success = rows_updated > 0
                
                print(f"[DEBUG] Результат отзыва владения: {success}, обновлено строк: {rows_updated}")
                
                self.connection.commit()
                print(f"[DEBUG] Транзакция завершена")
                
                if success:
                    return {"success": True, "message": f"Владение {building_type} успешно отозвано"}
                else:
                    return {"success": False, "message": "Это здание не принадлежит вам или не существует"}
        except Exception as e:
            print(f"[ERROR] Ошибка при отзыве владения зданием: {e}")
            return {"success": False, "message": str(e)}
    
    def relinquish_castle(self, user_id, x, y):
        try:
            with self.connection.cursor() as cursor:
                # Объявляем OUT-параметры
                result_var = cursor.var(int)
                message_var = cursor.var(str)
                
                # Вызываем процедуру
                cursor.callproc("game_logic_pkg.relinquish_castle", 
                               [user_id, x, y, result_var, message_var])
                
                # Получаем значения OUT-параметров
                result = result_var.getvalue()
                message = message_var.getvalue()
                
                self.connection.commit()
                return {"success": result == 1, "message": message}
        except Exception as e:
            print(f"Error relinquishing castle: {e}")
            return {"success": False, "message": str(e)}
    
    def capture_castle(self, user_id, x, y):
        try:
            print(f"[DEBUG] GameServer.capture_castle вызвана с параметрами:")
            print(f"[DEBUG] user_id: {user_id}, x: {x}, y: {y}")
            
            with self.connection.cursor() as cursor:
                # Объявляем OUT-параметры
                result_var = cursor.var(int)
                message_var = cursor.var(str)
                
                print(f"[DEBUG] Вызываем процедуру game_logic_pkg.capture_castle")
                # Вызываем процедуру
                cursor.callproc("game_logic_pkg.capture_castle", 
                               [user_id, x, y, result_var, message_var])
                
                # Получаем значения OUT-параметров
                result = result_var.getvalue()
                message = message_var.getvalue()
                
                print(f"[DEBUG] Результат процедуры: result={result}, message='{message}'")
                
                self.connection.commit()
                print(f"[DEBUG] Транзакция завершена")
                
                return {"success": result == 1, "message": message}
        except Exception as e:
            print(f"[ERROR] Error capturing castle: {e}")
            return {"success": False, "message": str(e)}
    
    def get_user_resources(self, user_id):
        try:
            with self.connection.cursor() as cursor:
                # Объявляем OUT-параметры
                wood_var = cursor.var(int)
                ore_var = cursor.var(int)
                gold_var = cursor.var(int)
                
                # Вызываем процедуру
                cursor.callproc("game_logic_pkg.get_user_resources", 
                               [user_id, wood_var, ore_var, gold_var])
                
                return {
                    'success': True,
                    'resources': {
                        'wood': wood_var.getvalue(),
                        'ore': ore_var.getvalue(),
                        'gold': gold_var.getvalue()
                    }
                }
        except Exception as e:
            print(f"Ошибка при получении ресурсов пользователя: {e}")
            return {'success': False, 'message': str(e)}
    
    def add_resources_from_buildings(self, user_id):
        try:
            with self.connection.cursor() as cursor:
                cursor.callproc("game_logic_pkg.add_resources_from_buildings", [user_id])
                return {'success': True}
        except Exception as e:
            print(f"Ошибка при добавлении ресурсов: {e}")
            return {'success': False, 'message': str(e)}
    
    def upgrade_building(self, user_id, x, y, building_type):
        try:
            # Вызываем процедуру из пакета game_logic_pkg
            cursor = self.connection.cursor()
            result = cursor.var(int)
            message = cursor.var(str)
            
            cursor.callproc('game_logic_pkg.upgrade_building', 
                          [user_id, x, y, building_type, result, message])
            
            if result.getvalue() == 1:
                # Обновляем ресурсы пользователя
                
                return {'success': True, 'message': message.getvalue()}
            else:
                return {'success': False, 'message': message.getvalue()}
                
        except Exception as e:
            print(f"Ошибка при улучшении здания: {str(e)}")
            return {'success': False, 'message': f'Ошибка при улучшении здания: {str(e)}'}
    
    def close(self):
        if self.cursor:
            self.cursor.close()
        if self.connection:
            self.connection.close()

    def get_building_info(self, x, y, building_type):
        try:
            cursor = self.connection.cursor()
            cursor.execute("""
                SELECT "level", owner_id, 
                       CASE 
                           WHEN type = 'SAWMILL' THEN FLOOR(80 * POWER(1.5, "level" - 1))
                           ELSE NULL 
                       END as wood_production,
                       CASE 
                           WHEN type = 'MINE' THEN FLOOR(60 * POWER(1.5, "level" - 1))
                           ELSE NULL 
                       END as ore_production,
                       CASE 
                           WHEN type = 'MINE' THEN FLOOR(40 * POWER(1.5, "level" - 1))
                           ELSE NULL 
                       END as gold_production
                FROM buildings 
                WHERE x = ? AND y = ? AND type = ?
            """, (x, y, building_type))
            
            building = cursor.fetchone()
            if not building:
                return {'success': False, 'message': 'Здание не найдено'}
            
            return {
                'success': True,
                'building': {
                    'level': building[0],
                    'owner_id': building[1],
                    'wood_production': building[2],
                    'ore_production': building[3],
                    'gold_production': building[4]
                }
            }
                
        except Exception as e:
            print(f"Ошибка при получении информации о здании: {str(e)}")
            return {'success': False, 'message': f'Ошибка при получении информации о здании: {str(e)}'}

    def hire_army(self, user_id, unit_type, count, x, y):
        try:
            if unit_type == 'ARCHER':
                x += 2
                y += 1
            elif unit_type == 'TANK':
                x += 4
                y += 2
            result = self.cursor.var(int)
            message = self.cursor.var(str)
            self.cursor.callproc("game_logic_pkg.hire_army", [user_id, unit_type, count, x, y, result, message])
            return {'success': result.getvalue() == 1, 'message': message.getvalue()}
        except Exception as e:
            print(f"[ОШИБКА] Найм армии невозможен. Вам не хватает ресурсов.")
            return {'success': False, 'message': str(e)}

    def get_user_army(self, user_id):
        try:
            army_cursor = self.connection.cursor()
            out_cursor = army_cursor.var(oracledb.CURSOR)
            self.cursor.callproc("game_logic_pkg.get_user_army", [user_id, out_cursor])
            army = []
            for row in out_cursor.getvalue():
                army.append({
                    'unitId': row[0],
                    'unitType': row[1],
                    'count': row[2],
                    'x': row[3],
                    'y': row[4],
                    'health': row[5],
                    'attack': row[6],
                    'defense': row[7]
                })
            return {'success': True, 'army': army}
        except Exception as e:
            print(f"[ОШИБКА] Ошибка при получении армии: {e}")
            return {'success': False, 'message': str(e)}

    def move_army(self, user_id, unit_id, new_x, new_y):
        try:
            result = self.cursor.var(int)
            message = self.cursor.var(str)
            self.cursor.callproc("game_logic_pkg.move_army", [user_id, unit_id, new_x, new_y, result, message])
            return {'success': result.getvalue() == 1, 'message': message.getvalue()}
        except Exception as e:
            print(f"[ОШИБКА] Ошибка при перемещении армии: {e}")
            return {'success': False, 'message': str(e)}

    def get_unit_types(self):
        try:
            out_cursor = self.cursor.var(oracledb.CURSOR)
            self.cursor.callproc("game_logic_pkg.get_unit_types", [out_cursor])
            types = []
            for row in out_cursor.getvalue():
                types.append({
                    'unitType': row[0],
                    'attack': row[1],
                    'defense': row[2],
                    'health': row[3],
                    'woodCost': row[4],
                    'oreCost': row[5],
                    'goldCost': row[6]
                })
            return {'success': True, 'types': types}
        except Exception as e:
            print(f"[ОШИБКА] Ошибка при получении типов юнитов: {e}")
            return {'success': False, 'message': str(e)}

    def cheat_add_resources(self, user_id, wood, ore, gold):
        try:
            self.cursor.callproc("game_logic_pkg.cheat_add_resources", [user_id, wood, ore, gold])
            self.connection.commit()
            return {'success': True}
        except Exception as e:
            print(f"[ОШИБКА] Ошибка при добавлении ресурсов читом: {e}")
            return {'success': False, 'message': str(e)}

class GameRequestHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
    
    def do_GET(self):
        if self.path.startswith('/api'):
            self.handle_api_request()
        else:
            super().do_GET()
    
    def do_POST(self):
        if self.path.startswith('/api'):
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            try:
                request_data = json.loads(post_data.decode('utf-8'))
                print(f"[API] Получен POST-запрос: {request_data}")
                self.handle_api_request_post(request_data)
            except json.JSONDecodeError as e:
                print(f"[ОШИБКА] Ошибка декодирования JSON: {e}, данные: {post_data.decode('utf-8')}")
                self.send_error_response(400, 'Неверный формат JSON')
        else:
            self.send_error_response(404, 'Страница не найдена')
    
    def send_error_response(self, code, message):
        self.send_response(code)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps({'success': False, 'message': message}).encode())
    
    def send_success_response(self, data):
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        
        # Проверяем, есть ли ключ 'success' в data
        if 'success' in data and data['success'] is False:
            # Если success = False, отправляем как есть
            response_data = data
        else:
            # Иначе добавляем success = True и все остальные данные
            response_data = {'success': True}
            response_data.update(data)
        
        # Отладочный вывод
        print(f"[API] Отправляемые данные: {response_data}")
        
        self.wfile.write(json.dumps(response_data).encode())
    
    def handle_api_request(self):
        query_components = parse_qs(urllib.parse.urlparse(self.path).query)
        action = query_components.get('action', [''])[0]
        
        try:
            if action == 'login':
                username = query_components.get('username', [''])[0]
                password = query_components.get('password', [''])[0]
                response = self.handle_login_post({'username': username, 'password': password})
            elif action == 'register':
                username = query_components.get('username', [''])[0]
                password = query_components.get('password', [''])[0]
                response = self.handle_register_post({'username': username, 'password': password})
            elif action == 'get_game_state':
                user_id = query_components.get('userId', ['0'])[0]
                response = self.get_game_state({'userId': user_id})
            else:
                response = {'success': False, 'message': 'Неизвестное действие'}
        except Exception as e:
            print(f"[ОШИБКА] Ошибка при обработке GET-запроса: {e}")
            response = {'success': False, 'message': f'Ошибка: {str(e)}'}
        
        self.send_success_response(response)
    
    def handle_api_request_post(self, request_data):
        try:
            action = request_data.get('action')
            
            if action == 'login':
                response = self.handle_login_post(request_data)
            elif action == 'register':
                response = self.handle_register_post(request_data)
            elif action == 'logout':
                response = {'success': True, 'message': 'Выход выполнен успешно'}
            elif action == 'get_game_state':
                response = self.get_game_state(request_data)
            elif action == 'move_hero':
                response = self.move_hero_post(request_data)
            elif action == 'check_castle':
                response = self.check_castle_post(request_data)
            elif action == 'capture_castle':
                response = self.capture_castle_post(request_data)
            elif action == 'relinquish_castle':
                response = self.relinquish_castle_post(request_data)
            elif action == 'start_new_day':
                response = self.start_new_day_post(request_data)
            elif action == 'save_explored_tiles':
                response = self.save_explored_tiles_post(request_data)
            elif action == 'get_explored_tiles':
                response = self.get_explored_tiles_post(request_data)
            elif action == 'capture_building':
                response = self.capture_building_post(request_data)
            elif action == 'get_user_buildings':
                response = self.get_user_buildings_post(request_data)
            elif action == 'relinquish_building':
                response = self.relinquish_building_post(request_data)
            elif action == 'get_user_resources':
                response = self.get_user_resources_post(request_data)
            elif action == 'add_resources_from_buildings':
                response = self.add_resources_from_buildings_post(request_data)
            elif action == 'upgrade_building':
                response = self.upgrade_building_post(request_data)
            elif action == 'get_building_info':
                response = self.get_building_info_post(request_data)
            elif action == 'hire_army':
                response = self.hire_army_post(request_data)
            elif action == 'get_user_army':
                response = self.get_user_army_post(request_data)
            elif action == 'move_army':
                response = self.move_army_post(request_data)
            elif action == 'get_unit_types':
                response = self.get_unit_types_post(request_data)
            elif action == 'cheat_add_resources':
                response = self.cheat_add_resources_post(request_data)
            elif action == 'update_army_after_battle':
                response = self.update_army_after_battle_post(request_data)
            else:
                print(f"[ОШИБКА] Неизвестное действие: {action}")
                response = {'success': False, 'message': f'Неизвестное действие: {action}'}
        except Exception as e:
            print(f"[ОШИБКА] Ошибка при обработке POST-запроса: {e}")
            response = {'success': False, 'message': f'Ошибка: {str(e)}'}
        
        print(f"[API] Отправка ответа: {response}")
        self.send_success_response(response)
    
    def handle_login_post(self, data):
        username = data.get('username', '')
        password = data.get('password', '')
        
        if not username or not password:
            return {'success': False, 'message': 'Не указано имя пользователя или пароль'}
        
        result = game.authenticate_player(username, password)
        
        if result > 0:
            return {'success': True, 'userId': result, 'username': username}
        elif result == -1:
            return {'success': False, 'message': 'Неверные учетные данные'}
        else:
            return {'success': False, 'message': 'Пользователь уже авторизован'}
    
    def handle_register_post(self, data):
        username = data.get('username', '')
        password = data.get('password', '')
        
        if not username or not password:
            return {'success': False, 'message': 'Не указано имя пользователя или пароль'}
        
        result = game.register_player(username, password)
        
        if result > 0:
            return {'success': True, 'userId': result, 'username': username}
        else:
            return {'success': False, 'message': 'Пользователь уже существует'}
    
    def get_game_state(self, data):
        user_id = data.get('userId', 0)
        
        if not user_id:
            return {'success': False, 'message': 'Не указан ID пользователя'}
        
        state = game.get_game_state(int(user_id))
        if state:
            return {'success': True, 'state': state}
        else:
            return {'success': False, 'message': 'Ошибка при получении состояния игры'}
    
    def move_hero_post(self, data):
        user_id = data.get('userId', 0)
        new_x = data.get('newX', 0)
        new_y = data.get('newY', 0)
        
        if not user_id:
            return {'success': False, 'message': 'Не указан ID пользователя'}
        
        result = game.move_hero(user_id, new_x, new_y)
        print(f"[DEBUG] Результат move_hero: {result}")
        
        if result and result.get('success'):
            # В объекте state передаем все необходимые данные для клиента
            return {
                'state': {
                    'currentDay': result['state']['currentDay'],
                    'remainingSteps': result['state']['remainingSteps'],
                    'newDay': result['state']['newDay'],
                    'heroX': result['state']['heroX'],
                    'heroY': result['state']['heroY']
                }
            }
        else:
            return {'success': False, 'message': result.get('message', 'Невозможно переместиться в указанную точку')}
    
    def check_castle_post(self, data):
        user_id = data.get('userId', 0)
        hero_x = data.get('heroX', 0)
        hero_y = data.get('heroY', 0)
        
        print(f"[DEBUG] check_castle_post вызвана с параметрами:")
        print(f"[DEBUG] user_id: {user_id}")
        print(f"[DEBUG] hero_x: {hero_x}")
        print(f"[DEBUG] hero_y: {hero_y}")
        
        if not user_id:
            print("[DEBUG] Ошибка: не указан ID пользователя")
            return {'success': False, 'message': 'Не указан ID пользователя'}
            
        try:
            # Используем объект game вместо несуществующего cursor
            print(f"[DEBUG] Вызываем game.check_castle_interaction({user_id}, {hero_x}, {hero_y})")
            result = game.check_castle_interaction(user_id, hero_x, hero_y)
            print(f"[DEBUG] Результат check_castle_interaction: {result}")
            
            # Всегда проверяем, есть ли замок в базе данных, независимо от результата check_castle_interaction
            castle_info = {}
            owner_id = None
            production_rate = 0
            
            print(f"[DEBUG] Вызываем game.get_castle_info({hero_x}, {hero_y}, {user_id})")
            # Вызываем get_castle_info через объект game, передавая ID пользователя
            owner_id, production_rate = game.get_castle_info(hero_x, hero_y, user_id)
            print(f"[DEBUG] Результат get_castle_info: owner_id={owner_id}, production_rate={production_rate}")
            
            if owner_id is not None:
                # Замок найден в базе данных
                castle_info = {
                    'ownerId': owner_id,
                    'productionRate': production_rate
                }
                
                print(f"[DEBUG] Замок найден в базе данных, возвращаем castle_info: {castle_info}")
                return {'success': True, 'canInteract': True, 'castleInfo': castle_info}
            elif result > 0:
                # Замок не найден в базе данных, но есть на карте
                print(f"[DEBUG] Замок найден на карте, но не в базе данных")
                return {'success': True, 'canInteract': True, 'castleInfo': None}
            else:
                print(f"[DEBUG] Замок не найден ни на карте, ни в базе данных")
                return {'success': True, 'canInteract': False}
        except Exception as e:
            print(f"[ОШИБКА] Ошибка при проверке взаимодействия с замком: {e}")
            return {'success': False, 'message': f"Ошибка: {str(e)}"}
    
    def capture_castle_post(self, data):
        user_id = data.get('userId', 0)
        castle_x = data.get('castleX', 0)
        castle_y = data.get('castleY', 0)
        
        print(f"[DEBUG] capture_castle_post вызвана с параметрами:")
        print(f"[DEBUG] user_id: {user_id}")
        print(f"[DEBUG] castle_x: {castle_x}")
        print(f"[DEBUG] castle_y: {castle_y}")
        
        if not user_id:
            print("[DEBUG] Ошибка: не указан ID пользователя")
            return {'success': False, 'message': 'Не указан ID пользователя'}
            
        try:
            # Используем объект game для захвата замка
            print(f"[DEBUG] Вызываем game.capture_castle({user_id}, {castle_x}, {castle_y})")
            result = game.capture_castle(user_id, castle_x, castle_y)
            print(f"[DEBUG] Результат capture_castle: {result}")
            return result
        except Exception as e:
            print(f"[ОШИБКА] Ошибка при захвате замка: {e}")
            return {'success': False, 'message': f"Ошибка: {str(e)}"}
    
    def relinquish_castle_post(self, data):
        user_id = data.get('userId', 0)
        castle_x = data.get('castleX', 0)
        castle_y = data.get('castleY', 0)
        
        if not user_id:
            return {'success': False, 'message': 'Не указан ID пользователя'}
            
        try:
            # Используем объект game для отказа от замка
            result = game.relinquish_castle(user_id, castle_x, castle_y)
            return result
        except Exception as e:
            print(f"[ОШИБКА] Ошибка при отказе от владения замком: {e}")
            return {'success': False, 'message': f"Ошибка: {str(e)}"}
    
    def start_new_day_post(self, data):
        user_id = data.get('userId', 0)
        
        if not user_id:
            return {'success': False, 'message': 'Не указан ID пользователя'}
        
        game = GameServer()
        success = game.start_new_day(user_id)
        if success:
            # Добавляем ресурсы с зданий
            resources_result = game.add_resources_from_buildings(user_id)
            if not resources_result['success']:
                print(f"Ошибка при добавлении ресурсов: {resources_result.get('message')}")
            
            # Получаем обновленное состояние игры
            state = game.get_game_state(user_id)
            # Получаем обновленные ресурсы
            resources = game.get_user_resources(user_id)
            
            game.close()
            if state:
                response = {'success': True, 'state': state}
                if resources['success']:
                    response['resources'] = resources['resources']
                return response
            else:
                return {'success': False, 'message': 'Ошибка при получении состояния игры'}
        else:
            game.close()
            return {'success': False, 'message': 'Ошибка при начале нового дня'}
            
    def save_explored_tiles_post(self, data):
        user_id = data.get('userId', 0)
        explored_tiles = data.get('exploredTiles', {})
        
        if not user_id:
            return {'success': False, 'message': 'Не указан ID пользователя'}
            
        if not explored_tiles:
            return {'success': False, 'message': 'Нет данных об исследованных тайлах'}
        
        game = GameServer()
        success = game.save_explored_tiles(user_id, json.dumps(explored_tiles))
        game.close()
        
        return {'success': success}
        
    def get_explored_tiles_post(self, data):
        user_id = data.get('userId', 0)
        
        if not user_id:
            return {'success': False, 'message': 'Не указан ID пользователя'}
        
        game = GameServer()
        tiles_json = game.get_explored_tiles(user_id)
        game.close()
        
        try:
            # Проверяем, что tiles_json - это строка
            if isinstance(tiles_json, (bytes, bytearray)):
                tiles_json = tiles_json.decode('utf-8')
                
            tiles_data = json.loads(tiles_json)
            return {'success': True, 'exploredTiles': tiles_data}
        except json.JSONDecodeError as e:
            print(f"[ОШИБКА] Ошибка декодирования JSON: {e}, данные: {tiles_json}")
            return {'success': True, 'exploredTiles': {}}
        except Exception as e:
            print(f"[ОШИБКА] Непредвиденная ошибка при обработке данных: {e}")
            return {'success': True, 'exploredTiles': {}}
    
    def capture_building_post(self, data):
        user_id = data.get('userId', 0)
        x = data.get('x', 0)
        y = data.get('y', 0)
        building_type = data.get('buildingType', '')
        
        if not user_id:
            return {'success': False, 'message': 'Не указан ID пользователя'}
        
        result = game.capture_building(user_id, x, y, building_type)
        print(f"[DEBUG] Результат capture_building: {result}")
        
        return result
    
    def get_user_buildings_post(self, data):
        user_id = data.get('userId', 0)
        
        if not user_id:
            return {'success': False, 'message': 'Не указан ID пользователя'}
        
        buildings = game.get_user_buildings(user_id)
        if buildings['success']:
            return {'success': True, 'buildings': buildings['buildings']}
        else:
            return {'success': False, 'message': buildings['message']}
    
    def relinquish_building_post(self, data):
        user_id = data.get('userId', 0)
        x = data.get('x', 0)
        y = data.get('y', 0)
        building_type = data.get('buildingType', '')
        
        if not user_id:
            return {'success': False, 'message': 'Не указан ID пользователя'}
        
        result = game.relinquish_building(user_id, x, y, building_type)
        print(f"[DEBUG] Результат relinquish_building: {result}")
        
        return result

    def get_user_resources_post(self, data):
        user_id = data.get('userId', 0)
        
        if not user_id:
            return {'success': False, 'message': 'Не указан ID пользователя'}
        
        resources = game.get_user_resources(user_id)
        if resources['success']:
            return {'success': True, 'resources': resources['resources']}
        else:
            return {'success': False, 'message': resources['message']}

    def add_resources_from_buildings_post(self, data):
        user_id = data.get('userId', 0)
        
        if not user_id:
            return {'success': False, 'message': 'Не указан ID пользователя'}
        
        result = game.add_resources_from_buildings(user_id)
        if result['success']:
            return {'success': True}
        else:
            return {'success': False, 'message': result['message']}

    def upgrade_building_post(self, data):
        user_id = data.get('userId')
        x = data.get('x')
        y = data.get('y')
        building_type = data.get('buildingType')
        
        if not all([user_id, x, y, building_type]):
            return {'success': False, 'message': "Missing required parameters"}
        
        result = game.upgrade_building(user_id, x, y, building_type)
        return result

    def get_building_info_post(self, data):
        x = data.get('x')
        y = data.get('y')
        building_type = data.get('building_type')
        
        if not all([x, y, building_type]):
            return {'success': False, 'message': 'Не указаны координаты или тип здания'}
        
        result = game.get_building_info(x, y, building_type)
        return result

    def hire_army_post(self, data):
        user_id = data.get('userId')
        unit_type = data.get('unitType')
        count = data.get('count')
        x = data.get('x')
        y = data.get('y')
        if not all([user_id, unit_type, count, x, y]):
            return {'success': False, 'message': 'Не указаны все параметры найма'}
        return game.hire_army(user_id, unit_type, count, x, y)

    def get_user_army_post(self, data):
        user_id = data.get('userId')
        if not user_id:
            return {'success': False, 'message': 'Не указан ID пользователя'}
        return game.get_user_army(user_id)

    def move_army_post(self, data):
        user_id = data.get('userId')
        unit_id = data.get('unitId')
        new_x = data.get('newX')
        new_y = data.get('newY')
        if not all([user_id, unit_id, new_x, new_y]):
            return {'success': False, 'message': 'Не указаны параметры перемещения'}
        return game.move_army(user_id, unit_id, new_x, new_y)

    def get_unit_types_post(self, data):
        return game.get_unit_types()

    def cheat_add_resources_post(self, data):
        user_id = data.get('userId')
        wood = int(data.get('wood', 0))
        ore = int(data.get('ore', 0))
        gold = int(data.get('gold', 0))
        if not user_id:
            return {'success': False, 'message': 'Не указан ID пользователя'}
        return game.cheat_add_resources(user_id, wood, ore, gold)

    def update_army_after_battle_post(self, data):
        user_id = data.get('userId', 0)
        army = data.get('army', [])
        if not user_id:
            return {'success': False, 'message': 'Не указан ID пользователя'}
        try:
            with game.connection.cursor() as cursor:
                # Получаем все текущие юниты пользователя
                cursor.execute("SELECT unit_type, x_coord, y_coord FROM army_units WHERE user_id = :user_id", user_id=user_id)
                existing_units = set((row[0], row[1], row[2]) for row in cursor.fetchall())
                # Обновляем или удаляем
                for unit in army:
                    unit_type = unit.get('unitType')
                    count = int(unit.get('count', 0))
                    x = int(unit.get('x', 0))
                    y = int(unit.get('y', 0))
                    if count > 0:
                        # Обновляем количество
                        cursor.execute("""
                            UPDATE army_units SET count = :count
                            WHERE user_id = :user_id AND unit_type = :unit_type AND x_coord = :x AND y_coord = :y
                        """, count=count, user_id=user_id, unit_type=unit_type, x=x, y=y)
                    else:
                        # Удаляем запись
                        cursor.execute("""
                            DELETE FROM army_units
                            WHERE user_id = :user_id AND unit_type = :unit_type AND x_coord = :x AND y_coord = :y
                        """, user_id=user_id, unit_type=unit_type, x=x, y=y)
                game.connection.commit()
            return {'success': True}
        except Exception as e:
            print(f'Ошибка при обновлении армии после боя: {e}')
            return {'success': False, 'message': str(e)}

# Запуск сервера
PORT = 8000

try:
    # Создаем экземпляр игры
    game = GameServer()

    print(f"Сервер запущен на порту {PORT}")
    with socketserver.TCPServer(("", PORT), GameRequestHandler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nСервер остановлен")
        finally:
            game.close()
except Exception as e:
    print(f"Критическая ошибка при запуске сервера: {e}") 