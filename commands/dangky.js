const {
  SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder
} = require('discord.js');
const sheets = require('../sheets');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('dangky-xe')
    .setDescription('Đăng ký sử dụng xe công ty')
    .addStringOption(opt =>
      opt.setName('ngay').setDescription('Ngày đi (VD: 20/03/2026)').setRequired(true))
    .addStringOption(opt =>
      opt.setName('gio').setDescription('Giờ đi (VD: 08:00)').setRequired(true))
    .addStringOption(opt =>
      opt.setName('diem_den').setDescription('Điểm đến').setRequired(true))
    .addStringOption(opt =>
      opt.setName('muc_dich').setDescription('Mục đích chuyến đi').setRequired(true))
    .addIntegerOption(opt =>
      opt.setName('so_nguoi').setDescription('Số người đi (kể cả tài xế)').setRequired(true).setMinValue(1).setMaxValue(10)),

  async execute(interaction, pendingBookings) {
    const date = interaction.options.getString('ngay');
    const time = interaction.options.getString('gio');
    const destination = interaction.options.getString('diem_den');
    const purpose = interaction.options.getString('muc_dich');
    const passengers = interaction.options.getInteger('so_nguoi');

    await interaction.deferReply({ ephemeral: true });

    try {
      const cars = await sheets.getCarList(date);

      if (cars.length === 0) {
        return await interaction.editReply({ content: `❌ Tất cả xe đã được đặt vào ngày *${date}*. Vui lòng chọn ngày khác hoặc liên hệ Hành chính.` });
      }

      // Lưu tạm vào memory, key = userId
      const tempId = `${interaction.user.id}_${Date.now()}`;
      pendingBookings.set(tempId, { date, time, destination, purpose, passengers, userId: interaction.user.id, userName: interaction.user.username });

      // Xóa sau 5 phút nếu không chọn
      setTimeout(() => pendingBookings.delete(tempId), 5 * 60 * 1000);

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`select_car_${tempId}`)
        .setPlaceholder('Chọn xe muốn đăng ký...')
        .addOptions(
          cars.map(car => ({
            label: car.name,
            description: car.plate || 'Không có biển số',
            value: `${car.name}||${car.plate}`,
          }))
        );

      const row = new ActionRowBuilder().addComponents(selectMenu);

      await interaction.editReply({
        content: `📋 Thông tin đăng ký:\n📅 ${date} | 🕐 ${time} | 📍 ${destination} | 👥 ${passengers} người\n\n*Chọn xe bên dưới:*`,
        components: [row],
      });

    } catch (err) {
      console.error(err);
      await interaction.editReply({ content: '❌ Có lỗi xảy ra, vui lòng thử lại.' });
    }
  },
};
